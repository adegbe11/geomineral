"""Surface alteration from Sentinel-2 (ESA Copernicus, free; read from AWS Open Data).

On bare ground, two classic band ratios flag rock that fluids have changed:
iron oxides (red / blue) and clays and other hydroxyl minerals (SWIR1 / SWIR2).
Pixels well above the scene's own background are mapped. Vegetation, cloud and
water are masked out; where too little bare ground shows, nothing is claimed.
"""

import asyncio
import math

import httpx
import numpy as np

from .schemas import Evidence, ProviderResult, Source

SENTINEL2 = Source(
    id="sentinel-2",
    provider_name="ESA Copernicus via Element 84 Earth Search",
    provider_type="satellite",
    dataset_name="Sentinel-2 surface reflectance (L2A)",
    source_url="https://registry.opendata.aws/sentinel-2-l2a-cogs/",
    api_url="https://earth-search.aws.element84.com/v1/search",
    licence="Copernicus open licence",
    commercial_use_allowed=True,
    resolution="Read at about 150 m from 20 m bands",
    notes="Band ratios on bare ground only. Surface staining, not proof of ore below.",
)
BANDS = ("blue", "red", "nir", "swir16", "swir22", "scl")
SIZE = 300
GRID = 30
# Ratio floors keep a uniform scene from producing "anomalies" out of noise.
FLOOR = {"iron": 1.9, "clay": 1.25}
NOTABLE = 0.05  # share of bare ground well above background


def search_body(lat: float, lng: float, bbox: list[float]) -> dict:
    return {
        "collections": ["sentinel-2-l2a"],
        "bbox": bbox,
        "datetime": "2021-01-01T00:00:00Z/..",
        "query": {"eo:cloud_cover": {"lt": 20}},
        "limit": 30,
        "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}],
    }


def _day(f: dict) -> str:
    return str(f["properties"].get("datetime", ""))[:10]


def pick_days(features: list[dict], count: int = 3) -> list[str]:
    """Clearest days, at least two months apart, so different seasons get a look."""
    picked: list[str] = []
    for day in dict.fromkeys(_day(f) for f in features if _day(f)):
        month = int(day[5:7])
        if all(min(abs(month - int(p[5:7])), 12 - abs(month - int(p[5:7]))) >= 2 for p in picked):
            picked.append(day)
        if len(picked) == count:
            break
    return picked


def day_tiles(features: list[dict], bbox: list[float]) -> tuple[list[dict], float]:
    """Tiles from one day that touch the radius, and how much of it they cover together."""
    from shapely.geometry import box, shape
    from shapely.ops import unary_union

    area = box(*bbox)
    tiles = [f for f in features if shape(f["geometry"]).intersects(area)]
    if not tiles:
        return [], 0.0
    union = unary_union([shape(f["geometry"]) for f in tiles])
    return tiles, union.intersection(area).area / area.area


def _read(href: str, bbox: list[float], nearest: bool) -> np.ndarray:
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.warp import transform_bounds
    from rasterio.windows import from_bounds

    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", AWS_NO_SIGN_REQUEST="YES", GDAL_HTTP_MAX_RETRY="2"
    ):
        with rasterio.open(href) as ds:
            w = from_bounds(*transform_bounds("EPSG:4326", ds.crs, *bbox), ds.transform)
            return ds.read(
                1,
                window=w,
                out_shape=(SIZE, SIZE),
                boundless=True,
                fill_value=0,
                resampling=Resampling.nearest if nearest else Resampling.average,
            ).astype("float32")


def analyse(b: dict[str, np.ndarray], lat: float, lng: float, radius_km: float) -> dict:
    """Pure array maths, kept separate so it is testable without network."""
    px_km = 2 * radius_km / SIZE
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    inside = np.hypot((xx - SIZE / 2) * px_km, (yy - SIZE / 2) * px_km) <= radius_km
    valid = inside & (b["blue"] > 0) & np.isin(b["scl"], [4, 5, 7])
    ndvi = (b["nir"] - b["red"]) / np.maximum(b["nir"] + b["red"], 1)
    bare = valid & (ndvi < 0.3)
    out = {
        "bare_pct": round(float(bare.sum() / max(inside.sum(), 1) * 100), 1),
        "clear_pct": round(float(valid.sum() / max(inside.sum(), 1) * 100), 1),
        "readable": bool(bare.sum() >= 200),
        "cells": [],
    }
    ratios = {
        "iron": b["red"] / np.maximum(b["blue"], 1),
        "clay": b["swir16"] / np.maximum(b["swir22"], 1),
    }
    step = SIZE // GRID
    kx = 111.32 * math.cos(math.radians(lat))
    for kind, idx in ratios.items():
        out[f"{kind}_km2"] = 0.0
        out[f"{kind}_share"] = 0.0
        if not out["readable"]:
            continue
        v = idx[bare]
        thr = max(float(v.mean() + 2 * v.std()), FLOOR[kind])
        hot = bare & (idx > thr)
        out[f"{kind}_km2"] = round(float(hot.sum() * px_km * px_km), 1)
        out[f"{kind}_share"] = round(float(hot.sum() / bare.sum()), 3)
        for i in range(GRID):
            for j in range(GRID):
                sl = (slice(i * step, (i + 1) * step), slice(j * step, (j + 1) * step))
                nb = int(bare[sl].sum())
                if nb < 5:
                    continue
                frac = float(hot[sl].sum() / nb)
                if frac <= 0:
                    continue
                cy = ((i + 0.5) * step - SIZE / 2) * px_km
                cx = ((j + 0.5) * step - SIZE / 2) * px_km
                out["cells"].append(
                    {
                        "kind": kind,
                        "lat": round(lat - cy / 110.57, 5),
                        "lng": round(lng + cx / kx, 5),
                        "frac": round(frac, 3),
                    }
                )
    out["iron_notable"] = out["iron_share"] >= NOTABLE and out["iron_km2"] >= 1
    out["clay_notable"] = out["clay_share"] >= NOTABLE and out["clay_km2"] >= 1
    return out


class SatelliteProvider:
    source = SENTINEL2

    async def fetch(self, client: httpx.AsyncClient, location, radius_km):
        lat, lng = location.lat, location.lng
        dlat = radius_km / 111.0
        dlng = radius_km / max(111.0 * math.cos(math.radians(lat)), 1.0)
        bbox = [lng - dlng, lat - dlat, lng + dlng, lat + dlat]
        r = await client.post(self.source.api_url, json=search_body(lat, lng, bbox))
        r.raise_for_status()
        days = pick_days(r.json().get("features", []))
        if not days:
            return ProviderResult(
                source=self.source, status="empty", message="No clear satellite scene here yet."
            )
        # Tiles from one day are stitched, so pins near tile corners are covered.
        # Up to three seasons are read side by side; the one showing most bare ground wins.

        async def read_day(day: str):
            body = search_body(lat, lng, bbox)
            body.update(datetime=f"{day}T00:00:00Z/{day}T23:59:59Z", limit=12)
            body.pop("sortby")
            r = await client.post(self.source.api_url, json=body)
            r.raise_for_status()
            tiles, _ = day_tiles(r.json().get("features", []), bbox)
            if not tiles:
                return None
            reads = await asyncio.gather(
                *(
                    asyncio.to_thread(_read, t["assets"][k]["href"], bbox, k == "scl")
                    for k in BANDS
                    for t in tiles
                )
            )
            merged = {}
            for i, k in enumerate(BANDS):
                acc = reads[i * len(tiles)]
                for arr in reads[i * len(tiles) + 1 : (i + 1) * len(tiles)]:
                    acc = np.where(acc > 0, acc, arr)
                merged[k] = acc
            stats = await asyncio.to_thread(analyse, merged, lat, lng, radius_km)
            return stats, tiles

        results = [
            x
            for x in await asyncio.gather(*(read_day(d) for d in days), return_exceptions=True)
            if x and not isinstance(x, BaseException)
        ]
        if not results:
            return ProviderResult(
                source=self.source, status="empty", message="No clear satellite scene here yet."
            )
        stats, tiles = max(results, key=lambda x: (x[0]["readable"], x[0]["bare_pct"]))
        scene = tiles[0]
        cells = stats.pop("cells")
        stats.update(
            scene=scene["id"],
            tiles=len(tiles),
            date=_day(scene),
            cloud=round(float(scene["properties"].get("eo:cloud_cover", 0)), 1),
        )
        if not stats["readable"]:
            text = (
                f"Only {stats['bare_pct']:g}% of the ground is bare in the clearest scene; "
                "vegetation hides the rock."
            )
        else:
            text = (
                f"Iron-oxide staining over {stats['iron_km2']:g} km² and clay alteration over "
                f"{stats['clay_km2']:g} km² of bare ground ({stats['bare_pct']:g}% bare)."
            )
        return ProviderResult(
            source=self.source,
            status="available" if stats["readable"] else "empty",
            evidence=[
                Evidence(
                    id=f"satellite:{scene['id']}",
                    source_id=self.source.id,
                    feature_id=scene["id"],
                    evidence_type="alteration",
                    observed_or_inferred="observed",
                    description=text,
                    raw_value=stats,
                )
            ],
            layers={"alteration": cells},
            message=f"Sentinel-2 scene {stats['date']}, {stats['cloud']:g}% cloud.",
        )
