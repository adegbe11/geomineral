"""Magnetics from NOAA's global anomaly grid (EMAG2v3, 2 arc-minute, public domain).

Magnetic highs can mark magnetite-rich rock; sharp gradients mark contacts and faults.
Where airborne surveys are sparse the grid is smoothed, so a quiet result there is
weak evidence of absence and is never used against a mineral.
"""

import io
import math

import httpx
import numpy as np
from PIL import Image

from .schemas import Evidence, ProviderResult, Source

EMAG2 = Source(
    id="emag2",
    provider_name="NOAA NCEI",
    provider_type="geophysics",
    dataset_name="Earth Magnetic Anomaly Grid (EMAG2v3)",
    source_url="https://www.ncei.noaa.gov/products/earth-magnetic-model-anomaly-grid-2",
    api_url="https://gis.ngdc.noaa.gov/arcgis/rest/services/EMAG2v3/ImageServer/exportImage",
    licence="Public domain (U.S. Government)",
    commercial_use_allowed=True,
    resolution="About 3.7 km; smoothed where airborne surveys are sparse",
    notes="Total-field anomaly at 4 km altitude. Not a substitute for a ground survey.",
)
STRONG_HIGH_NT = 300
STRONG_GRAD = 30  # nT/km
CONTACT_GRAD = 8


def _bearing(dx: float, dy: float) -> str:
    names = [
        "north",
        "north-east",
        "east",
        "south-east",
        "south",
        "south-west",
        "west",
        "north-west",
    ]
    return names[round((math.degrees(math.atan2(dx, dy)) % 360) / 45) % 8]


def describe(grid: np.ndarray, radius_km: float) -> dict:
    n = grid.shape[0]
    px = 2 * radius_km / n
    ys, xs = np.mgrid[0:n, 0:n]
    dx = (xs - (n - 1) / 2) * px
    dy = ((n - 1) / 2 - ys) * px
    inside = np.hypot(dx, dy) <= radius_km
    gy, gx = np.gradient(grid, px)
    grad = np.hypot(gx, gy)
    vals = np.where(inside, grid, np.nan)
    hi = np.unravel_index(np.nanargmax(vals), vals.shape)
    g = np.where(inside, grad, np.nan)
    grad_max = float(np.nanmax(g))
    high = float(vals[hi])
    contrast = float(np.nanmax(vals) - np.nanmin(vals))
    if high >= STRONG_HIGH_NT or grad_max >= STRONG_GRAD:
        level = "strong"
    elif grad_max >= CONTACT_GRAD:
        level = "contacts"
    else:
        level = "quiet"
    return {
        "level": level,
        "pin_nt": round(float(grid[n // 2, n // 2]), 1),
        "high_nt": round(high, 1),
        "high_km": round(float(math.hypot(dx[hi], dy[hi])), 1),
        "high_dir": _bearing(float(dx[hi]), float(dy[hi])),
        "contrast_nt": round(contrast, 1),
        "grad_max": round(grad_max, 1),
    }


class MagneticsProvider:
    source = EMAG2

    async def fetch(self, client: httpx.AsyncClient, location, radius_km):
        dlat = radius_km / 111.0
        dlng = radius_km / max(111.0 * math.cos(math.radians(location.lat)), 1.0)
        n = int(min(64, max(16, math.ceil(2 * radius_km / 1.5))))
        r = await client.get(
            self.source.api_url,
            params={
                "bbox": f"{location.lng - dlng},{location.lat - dlat},"
                f"{location.lng + dlng},{location.lat + dlat}",
                "bboxSR": 4326,
                "imageSR": 4326,
                "size": f"{n},{n}",
                "format": "tiff",
                "pixelType": "F32",
                "interpolation": "RSP_BilinearInterpolation",
                "f": "image",
            },
        )
        r.raise_for_status()
        try:
            grid = np.array(Image.open(io.BytesIO(r.content)), dtype="float64")
        except OSError as exc:
            raise ValueError("Magnetic grid unreadable") from exc
        if grid.ndim != 2 or not np.isfinite(grid).any():
            raise ValueError("Magnetic grid empty")
        stats = describe(grid, radius_km)
        text = {
            "strong": "Strong magnetic contrast",
            "contacts": "Magnetic contacts",
            "quiet": "Magnetically quiet",
        }[stats["level"]]
        return ProviderResult(
            source=self.source,
            status="available",
            evidence=[
                Evidence(
                    id="magnetics:emag2",
                    source_id=self.source.id,
                    feature_id="emag2v3",
                    evidence_type="magnetics",
                    observed_or_inferred="observed",
                    description=f"{text}: anomaly {stats['pin_nt']:g} nT at the pin, high of "
                    f"{stats['high_nt']:g} nT {stats['high_km']:g} km {stats['high_dir']}.",
                    raw_value=stats,
                )
            ],
            message="Regional magnetic anomaly grid; resolution about 3.7 km.",
        )
