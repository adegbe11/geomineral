"""Terrain from open elevation tiles (Mapzen Terrarium on AWS Open Data, no key).

Elevation, relief and slope describe where rock is exposed and where weathered
material collects. Flat valley floors are where heavy minerals form placers.
"""

import asyncio
import io
import math

import httpx
import numpy as np
from PIL import Image

from .schemas import Evidence, ProviderResult, Source

TERRAIN = Source(
    id="terrain",
    provider_name="AWS Open Data / Mapzen",
    provider_type="terrain",
    dataset_name="Terrarium elevation tiles",
    source_url="https://registry.opendata.aws/terrain-tiles/",
    api_url="https://s3.amazonaws.com/elevation-tiles-prod/terrarium",
    licence="Open data; attribution to the original elevation sources",
    commercial_use_allowed=True,
    resolution="About 75–300 m depending on radius",
    notes="Blended from SRTM, GMTED and national elevation models.",
)


def _tile(lat: float, lng: float, z: int) -> tuple[float, float]:
    n = 2**z
    x = (lng + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def _latlng(x: float, y: float, z: int) -> tuple[float, float]:
    n = 2**z
    lng = x / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lng


def describe(elev: np.ndarray, inside: np.ndarray, px_m: float, pin: float) -> dict:
    gy, gx = np.gradient(elev, px_m)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    e, s = elev[inside], slope[inside]
    low = np.percentile(e, 25)
    return {
        "pin_m": round(pin),
        "min_m": round(float(e.min())),
        "max_m": round(float(e.max())),
        "relief_m": round(float(e.max() - e.min())),
        "mean_slope": round(float(s.mean()), 1),
        "steep_pct": round(float((s > 15).mean() * 100), 1),
        "valley_pct": round(float(((s < 2) & (e <= low)).mean() * 100), 1),
    }


class TerrainProvider:
    source = TERRAIN

    async def fetch(self, client: httpx.AsyncClient, location, radius_km):
        dlat = radius_km / 111.0
        dlng = radius_km / max(111.0 * math.cos(math.radians(location.lat)), 1.0)
        # Tiles stretch towards the poles; step down until the radius fits in 16 tiles.
        for z in range(11, 5, -1):
            x0, y0 = _tile(location.lat + dlat, location.lng - dlng, z)
            x1, y1 = _tile(location.lat - dlat, location.lng + dlng, z)
            xs = range(int(x0), int(x1) + 1)
            ys = range(int(y0), int(y1) + 1)
            if len(xs) * len(ys) <= 16:
                break

        async def get(x, y):
            r = await client.get(f"{self.source.api_url}/{z}/{x}/{y}.png")
            r.raise_for_status()
            rgb = np.asarray(Image.open(io.BytesIO(r.content)).convert("RGB"), dtype="float64")
            return rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768

        tiles = await asyncio.gather(*(get(x, y) for y in ys for x in xs))
        rows = [np.hstack(tiles[i * len(xs) : (i + 1) * len(xs)]) for i in range(len(ys))]
        mosaic = np.vstack(rows)
        # Crop to the search box, then mask the circle.
        px0, py0 = (x0 - xs[0]) * 256, (y0 - ys[0]) * 256
        px1, py1 = (x1 - xs[0]) * 256, (y1 - ys[0]) * 256
        elev = mosaic[int(py0) : int(math.ceil(py1)), int(px0) : int(math.ceil(px1))]
        h, w = elev.shape
        if h < 8 or w < 8:
            raise ValueError("Terrain window too small")
        px_m = 156543.03 * math.cos(math.radians(location.lat)) / 2**z
        yy, xx = np.mgrid[0:h, 0:w]
        dx = (xx - (w - 1) / 2) * px_m / 1000
        dy = (yy - (h - 1) / 2) * px_m / 1000
        inside = np.hypot(dx, dy) <= radius_km
        stats = describe(elev, inside, px_m, float(elev[h // 2, w // 2]))
        return ProviderResult(
            source=self.source,
            status="available",
            evidence=[
                Evidence(
                    id="terrain:terrarium",
                    source_id=self.source.id,
                    feature_id=f"z{z}",
                    evidence_type="terrain",
                    observed_or_inferred="observed",
                    description=f"Elevation {stats['pin_m']} m at the pin; relief "
                    f"{stats['relief_m']} m; flat valley floors cover {stats['valley_pct']:g}%.",
                    raw_value=stats,
                )
            ],
            message="Open elevation model; relief and slope across the radius.",
        )
