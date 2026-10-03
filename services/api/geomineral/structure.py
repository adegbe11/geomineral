"""Faults and mapped rock units around a point, from Macrostrat vector tiles.

Tiles carry real line and polygon geometry, so distances to faults are measured,
not guessed, and the same shapes can be drawn on the map.
"""

import asyncio
import math

import httpx
import mapbox_vector_tile
from shapely.geometry import LineString, shape
from shapely.geometry import Point as SPoint
from shapely.ops import transform

from .schemas import Evidence, Point, ProviderResult, Source

TILES = "https://tiles.macrostrat.org/carto/{z}/{x}/{y}.mvt"
STRUCTURE = Source(
    id="macrostrat-structure",
    provider_name="Macrostrat",
    provider_type="structure",
    dataset_name="Mapped faults and rock units",
    source_url="https://macrostrat.org",
    api_url="https://tiles.macrostrat.org/carto",
    licence="CC BY 4.0",
    commercial_use_allowed=True,
    resolution="Mapped line work; precision follows each source map's scale",
    notes="Faults shown are those on compiled geological maps; unmapped structures are not shown.",
)
STRUCTURAL = ("fault", "thrust", "shear", "dike", "dyke", "lineament", "fracture")


def zoom_for(radius_km: float) -> int:
    return 10 if radius_km <= 12 else 9 if radius_km <= 30 else 8


def tiles_for(lat: float, lng: float, radius_km: float, z: int):
    dlat = radius_km / 110.57
    dlng = radius_km / max(111.32 * math.cos(math.radians(lat)), 1)
    n = 2**z

    def tile(la, lo):
        x = int((lo + 180) / 360 * n)
        y = int((1 - math.asinh(math.tan(math.radians(la))) / math.pi) / 2 * n)
        return min(max(x, 0), n - 1), min(max(y, 0), n - 1)

    x0, y1 = tile(lat - dlat, lng - dlng)
    x1, y0 = tile(lat + dlat, lng + dlng)
    return [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)][:9]


def _to_lnglat(z: int, x: int, y: int, extent: int):
    n = 2**z

    def f(px, py, *_):
        lng = (x + px / extent) / n * 360 - 180
        merc = math.pi * (1 - 2 * (y + 1 - py / extent) / n)
        return lng, math.degrees(math.atan(math.sinh(merc)))

    return f


def _km(lat: float, lng: float):
    """Local equirectangular projection to kilometres around the pin."""
    kx = 111.32 * math.cos(math.radians(lat))

    def f(lo, la, *_):
        return (lo - lng) * kx, (la - lat) * 110.57

    return f


async def fetch_tiles(client: httpx.AsyncClient, lat: float, lng: float, radius_km: float, z: int):
    async def one(x, y):
        r = await client.get(TILES.format(z=z, x=x, y=y))
        r.raise_for_status()
        return x, y, mapbox_vector_tile.decode(r.content)

    return await asyncio.gather(*(one(x, y) for x, y in tiles_for(lat, lng, radius_km, z)))


def _from_km(lat: float, lng: float):
    kx = 111.32 * math.cos(math.radians(lat))

    def f(x, y, *_):
        return lng + x / kx, lat + y / 110.57

    return f


def parse(tiles, z: int, location: Point, radius_km: float):
    to_km = _km(location.lat, location.lng)
    pin = SPoint(0, 0)
    circle = pin.buffer(radius_km)
    # The same circle in degrees, so drawn shapes stop neatly at the search radius.
    edge = transform(_from_km(location.lat, location.lng), circle)
    faults: dict[int, dict] = {}
    units: dict[int, dict] = {}
    for x, y, tile in tiles:
        for name in ("lines", "units"):
            layer = tile.get(name)
            if not layer:
                continue
            geo = _to_lnglat(z, x, y, layer.get("extent", 4096))
            for feat in layer["features"]:
                props = feat["properties"]
                try:
                    g = transform(geo, shape(feat["geometry"]))
                except (ValueError, TypeError, KeyError):
                    continue
                local = transform(to_km, g)
                if not local.intersects(circle):
                    continue
                if name == "lines":
                    kind = str(props.get("type") or "").lower()
                    if not any(k in kind for k in STRUCTURAL):
                        continue
                    # A fault can span several tiles: keep every piece, nearest distance.
                    lid = int(props.get("line_id") or id(feat))
                    d = round(local.distance(pin), 2)
                    f = faults.setdefault(
                        lid,
                        {
                            "id": lid,
                            "type": props.get("type") or "Fault",
                            "distance_km": d,
                            "length_km": 0.0,
                            "parts": [],
                        },
                    )
                    f["distance_km"] = min(f["distance_km"], d)
                    f["length_km"] += local.intersection(circle).length
                    f["parts"].append(g.intersection(edge).simplify(0.0005))
                else:
                    mid = int(props.get("map_id") or id(feat))
                    u = units.setdefault(
                        mid,
                        {
                            "name": props.get("name") or "Unnamed unit",
                            "lith": props.get("lith") or "",
                            "age": props.get("age") or "",
                            "color": props.get("color") or "#999999",
                            "contains_pin": False,
                            "parts": [],
                        },
                    )
                    u["contains_pin"] = u["contains_pin"] or bool(local.contains(pin))
                    u["parts"].append(g.buffer(0).intersection(edge).simplify(0.002))
    return faults, units


class StructureProvider:
    source = STRUCTURE

    async def fetch(self, client, location: Point, radius_km: float) -> ProviderResult:
        # Detailed maps first; coarse continental maps only exist at lower zooms.
        z = zoom_for(radius_km)
        for z in dict.fromkeys((z, 7, 5)):
            tiles = await fetch_tiles(client, location.lat, location.lng, radius_km, z)
            faults, units = parse(tiles, z, location, radius_km)
            if faults or units:
                break
        nearest = min(faults.values(), key=lambda f: f["distance_km"], default=None)
        evidence = []
        if nearest:
            evidence.append(
                Evidence(
                    id=f"structure:fault:{nearest['id']}",
                    source_id=self.source.id,
                    feature_id=str(nearest["id"]),
                    evidence_type="structure",
                    direction="context",
                    observed_or_inferred="reported",
                    reliability="Mapped fault; position accuracy follows the source map",
                    distance_m=nearest["distance_km"] * 1000,
                    description=(
                        f"Nearest mapped {str(nearest['type']).lower()} is "
                        f"{nearest['distance_km']:.1f} km away; {len(faults)} mapped within "
                        f"{radius_km:g} km."
                    ),
                    raw_value={
                        "nearest_km": nearest["distance_km"],
                        "count": len(faults),
                        "total_km": round(sum(f["length_km"] for f in faults.values()), 1),
                    },
                )
            )
        return ProviderResult(
            source=self.source,
            status="available" if faults or units else "empty",
            evidence=evidence,
            layers={
                "faults": [
                    _line(f) for f in sorted(faults.values(), key=lambda f: f["distance_km"])[:150]
                ],
                "units": [_poly(u) for u in list(units.values())[:120]],
            },
            message=(
                f"{len(faults)} mapped faults and {len(units)} rock units within {radius_km:g} km."
            ),
        )


def _coords(geom, digits=4):
    if isinstance(geom, LineString):
        return (
            [[[round(x, digits), round(y, digits)] for x, y in geom.coords]] if geom.coords else []
        )
    # Multi-lines and mixed collections from clipping.
    return [path for g in getattr(geom, "geoms", []) for path in _coords(g, digits)]


def _line(f: dict) -> dict:
    return {
        "type": f["type"],
        "distance_km": f["distance_km"],
        "paths": [path for part in f["parts"] for path in _coords(part)],
    }


def _poly(u: dict) -> dict:
    polys = [p for g in u["parts"] for p in getattr(g, "geoms", [g])]
    rings = [
        [[round(x, 4), round(y, 4)] for x, y in p.exterior.coords]
        for p in polys
        if p.geom_type == "Polygon" and not p.is_empty
    ]
    return {
        "name": u["name"],
        "lith": u["lith"],
        "age": u["age"],
        "color": u["color"],
        "here": u["contains_pin"],
        "rings": rings,
    }
