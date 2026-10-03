"""Past positions of a point and past coastlines from the GPlates Web Service."""

import asyncio
import logging

import httpx
from shapely.geometry import shape

from .config import USER_AGENT

log = logging.getLogger(__name__)
GWS = "https://gws.gplates.org/reconstruct"
AGES = [0, 66, 100, 150, 200, 250, 300, 400, 500]
# MULLER2019 covers 0-250 Ma; MERDITH2021 reaches 1000 Ma but omits some regions.
model = lambda age: "MULLER2019" if age <= 250 else "MERDITH2021"  # noqa: E731
_points: dict[tuple, list] = {}
_coasts: dict[int, list] = {}


async def positions(lat: float, lng: float) -> list[dict | None]:
    key = (round(lat, 2), round(lng, 2))
    if key in _points:
        return _points[key]

    async def one(client, age):
        if age == 0:
            return {"age": 0, "lat": lat, "lng": lng}
        try:
            r = await client.get(
                f"{GWS}/reconstruct_points/",
                params={"points": f"{lng},{lat}", "time": age, "model": model(age)},
            )
            r.raise_for_status()
            x, y = r.json()["coordinates"][0]
            if abs(x) > 180 or abs(y) > 90:
                return None
            return {"age": age, "lat": round(y, 2), "lng": round(x, 2)}
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
            return None

    async with httpx.AsyncClient(timeout=25, headers={"User-Agent": USER_AGENT}) as client:
        result = list(await asyncio.gather(*(one(client, a) for a in AGES)))
    # Cache only complete answers so a temporary outage is retried.
    if all(p is not None or a > 250 for p, a in zip(result, AGES)):
        _points[key] = result
    return result


async def coastlines(age: int) -> list[list[list[float]]]:
    """Simplified land outlines as rings of [lng, lat]."""
    if age in _coasts:
        return _coasts[age]
    async with httpx.AsyncClient(timeout=40, headers={"User-Agent": USER_AGENT}) as client:
        r = await client.get(f"{GWS}/coastlines_low/", params={"time": age, "model": model(age)})
        r.raise_for_status()
        features = r.json()["features"]
    rings = []
    for f in features:
        try:
            geom = shape(f["geometry"]).simplify(0.6, preserve_topology=False)
        except (ValueError, KeyError, TypeError):
            continue
        polys = getattr(geom, "geoms", [geom])
        for poly in polys:
            if poly.is_empty or poly.geom_type != "Polygon" or poly.area < 0.5:
                continue
            ring = [[round(x, 1), round(y, 1)] for x, y in poly.exterior.coords]
            if len(ring) >= 4:
                rings.append(ring)
    _coasts[age] = rings
    return rings
