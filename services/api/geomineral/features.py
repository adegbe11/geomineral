"""Ground features for the learned prospectivity model.

One definition shared by training (scripts/train_prospectivity.py) and live analysis,
so a pin is described exactly the way the training points were. Features describe the
ground only: rock type and age, magnetics and terrain. Known mines are never inputs;
they are the answers the model is trained and tested against.
"""

import math

import numpy as np

# Rock families, matched against Macrostrat unit name, lithology and description.
LITH = {
    "granite": ["granit"],
    "felsic_intrusive": ["granodiorit", "tonalit", "monzonit", "syenit", "diorit", "aplite"],
    "mafic_intrusive": ["gabbro", "norite", "anorthosit", "dolerit", "diabase"],
    "ultramafic": ["ultramafic", "peridotit", "dunite", "serpentin", "komatii", "pyroxenit"],
    "felsic_volcanic": ["rhyolit", "dacit", "felsic", "tuff", "ignimbrit", "pyroclast"],
    "mafic_volcanic": ["basalt", "andesit", "mafic volcanic", "pillow"],
    "volcanic": ["volcanic", "volcaniclastic"],
    "plutonic": ["plutonic", "intrusive", "batholith", "pluton"],
    "greenstone": ["greenstone", "metavolcanic", "amphibolit", "greenschist"],
    "schist": ["schist", "phyllit", "slate"],
    "gneiss": ["gneiss", "migmatit", "granulit", "charnockit"],
    "quartzite": ["quartzit"],
    "metamorphic": ["metamorphic", "metasediment", "metased"],
    "carbonate": ["limestone", "dolomit", "dolostone", "carbonate", "marble", "chalk"],
    "sandstone": ["sandstone", "arenite", "conglomerat", "arkose", "greywacke", "graywacke"],
    "shale": ["shale", "mudstone", "siltstone", "claystone", "argillit", "marl"],
    "black_shale": ["black shale", "graphitic", "carbonaceous"],
    "coal": ["coal", "lignite"],
    "evaporite": ["evaporit", "gypsum", "halite", "anhydrit", "salt"],
    "iron_formation": ["iron formation", "banded iron", "ironstone", "jaspilit", "taconite"],
    "laterite": ["laterit", "bauxit", "duricrust"],
    "unconsolidated": ["alluvi", "unconsolidated", "gravel", "colluvi", "glacial", "till", "dune"],
    "sedimentary": ["sedimentary"],
    "pegmatite": ["pegmatit"],
    "kimberlite": ["kimberlit", "lamproit"],
    "carbonatite": ["carbonatit"],
    "porphyry": ["porphyr"],
    "chert": ["chert"],
    "ophiolite": ["ophiolit"],
    "crystalline": ["crystalline", "basement", "precambrian"],
}
AGES = [
    ("cenozoic", 0, 66),
    ("mesozoic", 66, 252),
    ("paleozoic", 252, 541),
    ("proterozoic", 541, 2500),
    ("archean", 2500, 4600),
]
NAMES = (
    [f"lith_{k}" for k in LITH]
    + [f"age_{a}" for a, _, _ in AGES]
    + ["age_top", "age_bottom", "units"]
    + ["mag_pin", "mag_max", "mag_min", "mag_std", "mag_grad_max", "mag_grad_mean"]
    + ["elev", "relief", "slope_mean", "slope_steep"]
)
FAMILY = {
    "Geology": [n for n in NAMES if n.startswith(("lith_", "age_", "units"))],
    "Magnetics": [n for n in NAMES if n.startswith("mag_")],
    "Terrain": ["elev", "relief", "slope_mean", "slope_steep"],
}
WINDOW_KM = 25
MAG_PX_KM = 3.7  # native EMAG2 cell
TERRAIN_PX_KM = 0.6


def geology(units: list[dict]) -> dict:
    """units: Macrostrat geologic_units/map rows (name, lith, descrip, t_age, b_age)."""
    text = " ".join(
        f"{u.get('name') or ''} {u.get('lith') or ''} {u.get('descrip') or ''}" for u in units
    ).lower()
    out = {f"lith_{k}": float(any(t in text for t in terms)) for k, terms in LITH.items()}
    tops = [float(u["t_age"]) for u in units if u.get("t_age") is not None]
    bottoms = [float(u["b_age"]) for u in units if u.get("b_age") is not None]
    top = min(tops) if tops else np.nan
    bottom = max(bottoms) if bottoms else np.nan
    for name, lo, hi in AGES:
        out[f"age_{name}"] = float(bool(tops) and top < hi and bottom > lo)
    out["age_top"], out["age_bottom"], out["units"] = top, bottom, float(len(units))
    return out


def magnetics(grid: np.ndarray, px_km: float) -> dict:
    """grid: anomaly in nT around the point (centre = point), any resolution."""
    g = _resample(grid, px_km, MAG_PX_KM)
    n = g.shape[0]
    gy, gx = np.gradient(g, MAG_PX_KM)
    grad = np.hypot(gx, gy)
    return {
        "mag_pin": float(g[n // 2, g.shape[1] // 2]),
        "mag_max": float(np.nanmax(g)),
        "mag_min": float(np.nanmin(g)),
        "mag_std": float(np.nanstd(g)),
        "mag_grad_max": float(np.nanmax(grad)),
        "mag_grad_mean": float(np.nanmean(grad)),
    }


def terrain(elev: np.ndarray, px_km: float) -> dict:
    e = _resample(elev, px_km, TERRAIN_PX_KM)
    gy, gx = np.gradient(e, TERRAIN_PX_KM * 1000)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    return {
        "elev": float(e[e.shape[0] // 2, e.shape[1] // 2]),
        "relief": float(np.nanpercentile(e, 95) - np.nanpercentile(e, 5)),
        "slope_mean": float(np.nanmean(slope)),
        "slope_steep": float(np.nanmean(slope > 15)),
    }


def vector(parts: dict) -> list[float]:
    return [float(parts.get(n, np.nan)) for n in NAMES]


def _resample(a: np.ndarray, px_km: float, target_km: float) -> np.ndarray:
    """Block-average (or keep) so both training and live grids share one cell size."""
    a = np.asarray(a, dtype="float64")
    k = max(1, int(round(target_km / max(px_km, 1e-6))))
    if k == 1:
        return a
    h, w = (a.shape[0] // k) * k, (a.shape[1] // k) * k
    if h < k or w < k:
        return a
    return a[:h, :w].reshape(h // k, k, w // k, k).mean(axis=(1, 3))


def window_deg(lat: float, km: float = WINDOW_KM) -> tuple[float, float]:
    return km / 111.0, km / max(111.0 * math.cos(math.radians(lat)), 1.0)
