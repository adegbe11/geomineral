"""Learned prospectivity: how much the ground at a pin resembles ground around real deposits.

Models are trained by scripts/train_prospectivity.py on USGS MRDS deposits worldwide and
random land, tested on spatially separate blocks, and shipped only if they pass. The pin is
described with features.py exactly as the training points were. Known mines are not inputs.
"""

import asyncio
import io
import json
import math
from functools import lru_cache
from pathlib import Path

import httpx
import numpy as np

from . import features as F
from .schemas import Evidence, ProviderResult, Source

MODELS = Path(__file__).parent / "models"
GROUND_MODEL = Source(
    id="ground-model",
    provider_name="GeoMineral",
    provider_type="model",
    dataset_name="Learned ground model",
    source_url="https://github.com/adegbe11/geomineral",
    api_url="local",
    licence="Trained on USGS MRDS, Macrostrat (CC BY 4.0), EMAG2, EIGEN-6C4, Terrarium",
    commercial_use_allowed=True,
    resolution="25 km window around the pin",
    notes="Similarity to ground around known deposits, tested on held-out regions. Not proof.",
)


@lru_cache(maxsize=1)
def gravity_grid():
    f = MODELS / "gravity_fa.npz"
    return F.GravityGrid(f) if f.exists() else None


@lru_cache(maxsize=1)
def magnetic_grid():
    f = MODELS / "magnetics_4min.npz"
    return F.GravityGrid(f, scale=1) if f.exists() else None


@lru_cache(maxsize=1)
def load() -> dict:
    import joblib

    if not (MODELS / "report.json").exists():
        return {}
    report = json.loads((MODELS / "report.json").read_text())
    out = {}
    for mineral, info in report["minerals"].items():
        f = MODELS / f"{mineral.replace(' ', '_').lower()}.joblib"
        if info.get("shipped") and f.exists():
            out[mineral] = {
                **joblib.load(f),
                "auc": info["auc"],
                "auc_outside_us": info.get("auc_outside_us"),
            }
    return out


def score(x: list[float]) -> list[dict]:
    """Per mineral: probability, rank among held-out non-deposit ground, layer contributions."""
    models = load()
    full = dict(zip(F.NAMES, x))
    out = []
    for mineral, m in models.items():
        # Each model reads the features it was trained on, by name.
        names = list(m["names"])
        X = np.array([[full.get(n, np.nan) for n in names]], dtype="float64")
        p = float(m["model"].predict_proba(X)[0, 1])
        # Share of ordinary ground (held-out negatives) that scores at least this high.
        top = 1.0 - float(np.searchsorted(m["neg"], p, side="left")) / max(len(m["neg"]), 1)
        # Share of real deposits (held out) that score at least this high.
        captured = 1.0 - float(np.searchsorted(m["pos"], p, side="left")) / max(len(m["pos"]), 1)
        layers = {}
        for family, members in F.FAMILY.items():
            idx = [names.index(n) for n in members if n in names]
            if not idx:
                continue
            ablated = X.copy()
            ablated[0, idx] = np.nan
            layers[family] = round(p - float(m["model"].predict_proba(ablated)[0, 1]), 3)
        out.append(
            {
                "mineral": mineral,
                "probability": round(p, 3),
                "top_pct": round(top * 100, 1),
                "deposit_pct": round(captured * 100, 1),
                "layers": layers,
                "auc": m["auc"],
            }
        )
    return sorted(out, key=lambda r: r["top_pct"])


async def describe(client: httpx.AsyncClient, lat: float, lng: float) -> list[float]:
    from PIL import Image

    dlat, dlng = F.window_deg(lat)

    async def units():
        r = await client.get(
            "https://macrostrat.org/api/v2/geologic_units/map", params={"lat": lat, "lng": lng}
        )
        r.raise_for_status()
        return r.json().get("success", {}).get("data", [])

    async def elev():
        z = 8
        k = 2**z

        def t(la, lo):
            return (lo + 180) / 360 * k, (
                1 - math.asinh(math.tan(math.radians(la))) / math.pi
            ) / 2 * k

        x0, y0 = t(lat + dlat, lng - dlng)
        x1, y1 = t(lat - dlat, lng + dlng)
        xs, ys = range(int(x0), int(x1) + 1), range(int(y0), int(y1) + 1)

        async def tile(x, y):
            r = await client.get(
                f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x % k}/{y}.png"
            )
            r.raise_for_status()
            rgb = np.asarray(Image.open(io.BytesIO(r.content)).convert("RGB"), dtype="float64")
            return rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768

        got = await asyncio.gather(*(tile(x, y) for y in ys for x in xs))
        mosaic = np.vstack(
            [np.hstack(got[i * len(xs) : (i + 1) * len(xs)]) for i in range(len(ys))]
        )
        e = mosaic[
            int((y0 - ys[0]) * 256) : int((y1 - ys[0]) * 256) + 1,
            int((x0 - xs[0]) * 256) : int((x1 - xs[0]) * 256) + 1,
        ]
        return e, 156543.03 * math.cos(math.radians(lat)) / k / 1000

    async def faults():
        from . import structure
        from .schemas import Point

        z = F.FAULT_ZOOM
        tiles = await structure.fetch_tiles(client, lat, lng, F.WINDOW_KM, z)
        if not any("lines" in t for _, _, t in tiles):
            return None
        found, _ = structure.parse(tiles, z, Point(lat=lat, lng=lng), F.WINDOW_KM)
        return found

    u, (e, px), fl = await asyncio.gather(units(), elev(), faults())
    # Magnetics from the bundled grid, exactly as in training.
    mg = magnetic_grid()
    m = mg.window(lat, lng) if mg else np.full((8, 8), np.nan)
    grid = gravity_grid()
    g = F.gravity(grid.window(lat, lng), F.GRAV_PX_KM) if grid else {}
    return F.vector(
        {
            **F.geology(u),
            **F.magnetics(m, F.MAG_PX_KM),
            **F.terrain(e, px),
            **g,
            **F.faults(fl),
        }
    )


class GroundModelProvider:
    source = GROUND_MODEL

    async def fetch(self, client: httpx.AsyncClient, location, radius_km):
        if not load():
            return ProviderResult(
                source=self.source, status="disabled", message="No trained models."
            )
        x = await describe(client, location.lat, location.lng)
        rows = await asyncio.to_thread(score, x)
        evidence = [
            Evidence(
                id=f"model:{r['mineral']}",
                source_id=self.source.id,
                feature_id=r["mineral"],
                evidence_type="ground_model",
                commodity=r["mineral"],
                direction="positive" if r["top_pct"] <= 15 else "context",
                observed_or_inferred="inferred",
                reliability=f"Held-out test AUC {r['auc']:.2f}",
                description=f"Ground here ranks in the top {r['top_pct']:g}% of land for "
                f"{r['mineral'].lower()}-bearing ground.",
                raw_value=r,
            )
            for r in rows
        ]
        return ProviderResult(
            source=self.source,
            status="available",
            evidence=evidence,
            message=f"{len(rows)} mineral models scored the ground around the pin.",
        )
