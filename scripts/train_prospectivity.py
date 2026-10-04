"""Train GeoMineral's learned prospectivity models from open data.

Stages (each resumable; outputs in services/api/.data/training):
  points    sample training points: USGS MRDS deposits per mineral + random land
  features  describe every point (Macrostrat rock, EMAG2 magnetics, Terrarium terrain)
  train     one gradient-boosted model per mineral, tested on spatially separate blocks

Known deposits are labels, never inputs. Models that fail the held-out test are not shipped.
Usage: PYTHONPATH=services/api python scripts/train_prospectivity.py points|features|train
"""

import asyncio
import csv
import io
import json
import math
import random
import sys
from pathlib import Path

import httpx
import numpy as np
from geomineral import features as F

ROOT = Path("services/api/.data/training")
MODELS = Path("services/api/geomineral/models")
UA = {"User-Agent": "GeoMineral/1.0 (https://github.com/adegbe11/geomineral)"}
MRDS_TO = {
    "Gold": "Gold",
    "Silver": "Silver",
    "Copper": "Copper",
    "Lead": "Lead",
    "Zinc": "Zinc",
    "Iron": "Iron",
    "Uranium": "Uranium",
    "Tungsten": "Tungsten",
    "Manganese": "Manganese",
    "Chromium": "Chromium",
    "Nickel": "Nickel",
    "Tin": "Tin",
    "Molybdenum": "Molybdenum",
    "Aluminum": "Aluminium",
    "Phosphorus-Phosphates": "Phosphate",
    "Fluorine-Fluorite": "Fluorite",
    "Barium-Barite": "Barite",
    "Limestone": "Limestone",
    "Gypsum-Anhydrite": "Gypsum",
    "Clay": "Clay",
    "Fire Clay (Refractory)": "Clay",
    "Kaolin": "Kaolin",
    "Lithium": "Lithium",
    "Diamond": "Diamond",
    "Graphite": "Graphite",
    "REE": "Rare earth elements",
    "Cobalt": "Cobalt",
    "Platinum": "Platinum",
    "Antimony": "Antimony",
    "Titanium": "Titanium",
    "Niobium (Columbium)": "Niobium",
    "Tantalum": "Tantalum",
}
PER_MINERAL = 600
# Common metals with varied deposit styles get more examples.
BIG = {
    "Gold": 1500,
    "Copper": 1500,
    "Silver": 1200,
    "Lead": 1200,
    "Zinc": 1200,
    "Iron": 1500,
    "Uranium": 1000,
}
RANDOM_LAND = 6000
BLOCK_DEG = 2.0  # spatial test blocks (~200 km)
SHIP_AUC = 0.75


def load_records():
    out = []
    for x in csv.DictReader(open(ROOT / "mrds.csv", encoding="utf-8", errors="replace")):
        try:
            lat, lng = float(x["latitude"]), float(x["longitude"])
        except ValueError:
            continue
        cs = {
            MRDS_TO[c.strip()]
            for k in ("commod1", "commod2")
            for c in (x.get(k) or "").split(",")
            if c.strip() in MRDS_TO
        }
        if cs and -90 < lat < 90 and -180 <= lng <= 180:
            out.append((x["dep_id"], lat, lng, sorted(cs), x["country"] != "United States"))
    return out


def blind_exclusions():
    """Keep the 45 blind-test mines (and 10 km around them) out of training."""
    f = Path("services/api/validation.json")
    if not f.exists():
        return []
    return [(r["lat"], r["lng"]) for r in json.load(open(f)) if r.get("truth")]


def km(a, b):
    dlat = math.radians(b[0] - a[0])
    dlng = math.radians(b[1] - a[1])
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlng / 2) ** 2
    )
    return 12742 * math.asin(math.sqrt(h))


def land(client, lat, lng):
    z = 6
    x = int((lng + 180) / 360 * 2**z)
    yf = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**z
    from PIL import Image

    key = (x, int(yf))
    if key not in land.cache:
        r = client.get(
            f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{int(yf)}.png"
        )
        land.cache[key] = np.asarray(Image.open(io.BytesIO(r.content)).convert("RGB"), dtype=float)
    rgb = land.cache[key]
    px = int(((lng + 180) / 360 * 2**z - x) * 255)
    py = int((yf - int(yf)) * 255)
    rr, g, b = rgb[py, px]
    return rr * 256 + g + b / 256 - 32768 > 5


land.cache = {}


def stage_points():
    random.seed(11)
    recs = load_records()
    blind = blind_exclusions()
    recs = [r for r in recs if all(km((r[1], r[2]), b) > 10 for b in blind)]
    by = {}
    for r in recs:
        for c in r[3]:
            by.setdefault(c, []).append(r)
    chosen = {}
    for c, rs in by.items():
        random.shuffle(rs)
        # Prefer deposits outside the USA, one per ~10 km cell, so the US does not dominate.
        rs.sort(key=lambda r: not r[4])
        seen, picked = set(), []
        for r in rs:
            cell = (round(r[1], 1), round(r[2], 1))
            if cell in seen:
                continue
            seen.add(cell)
            picked.append(r)
            if len(picked) >= BIG.get(c, PER_MINERAL):
                break
        for r in picked:
            chosen[r[0]] = r
    rows = [
        {
            "id": f"m{r[0]}",
            "lat": r[1],
            "lng": r[2],
            "minerals": "|".join(r[3]),
            "abroad": int(r[4]),
        }
        for r in chosen.values()
    ]
    client = httpx.Client(timeout=30, headers=UA)
    n = 0
    while n < RANDOM_LAND:
        lat = math.degrees(math.asin(random.uniform(-0.85, 0.97)))
        lng = random.uniform(-180, 180)
        try:
            if not land(client, lat, lng):
                continue
        except Exception:  # noqa: BLE001
            continue
        rows.append(
            {
                "id": f"r{n}",
                "lat": lat,
                "lng": lng,
                "minerals": "",
                "abroad": int(not (24 < lat < 50 and -125 < lng < -66)),
            }
        )
        n += 1
    with open(ROOT / "points.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "lat", "lng", "minerals", "abroad"])
        w.writeheader()
        w.writerows(rows)
    # Every deposit (all minerals) for labelling distances later.
    json.dump([[r[1], r[2], r[3]] for r in recs], open(ROOT / "deposits.json", "w"))
    print("points", len(rows), "minerals", len(by))


async def stage_features():
    import rasterio
    from PIL import Image
    from rasterio.windows import from_bounds

    pts = list(csv.DictReader(open(ROOT / "points.csv")))
    out_file = ROOT / "features.jsonl"
    done = set()
    if out_file.exists():
        done = {json.loads(line)["id"] for line in open(out_file)}
    todo = [p for p in pts if p["id"] not in done]
    print("to describe", len(todo), "of", len(pts), flush=True)
    mag = rasterio.open(ROOT / "emag2_upcont.tif")
    tiles: dict = {}
    sem = asyncio.Semaphore(10)
    out = open(out_file, "a")

    def mag_grid(lat, lng):
        dlat, dlng = F.window_deg(lat)
        lon360 = lng % 360
        w = from_bounds(lon360 - dlng, lat - dlat, lon360 + dlng, lat + dlat, mag.transform)
        a = mag.read(1, window=w, boundless=True, fill_value=np.nan).astype("float64")
        a[a < -1e30] = np.nan
        return a

    async def terrain_grid(client, lat, lng):
        z = 8
        dlat, dlng = F.window_deg(lat)

        def t(la, lo):
            n = 2**z
            return (lo + 180) / 360 * n, (
                1 - math.asinh(math.tan(math.radians(la))) / math.pi
            ) / 2 * n

        x0, y0 = t(lat + dlat, lng - dlng)
        x1, y1 = t(lat - dlat, lng + dlng)
        xs, ys = range(int(x0), int(x1) + 1), range(int(y0), int(y1) + 1)
        for x in xs:
            for y in ys:
                if (x, y) not in tiles:
                    r = await client.get(
                        f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x % 256}/{y}.png"
                    )
                    rgb = np.asarray(
                        Image.open(io.BytesIO(r.content)).convert("RGB"), dtype="float64"
                    )
                    tiles[(x, y)] = rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768
        mosaic = np.vstack([np.hstack([tiles[(x, y)] for x in xs]) for y in ys])
        e = mosaic[
            int((y0 - ys[0]) * 256) : int((y1 - ys[0]) * 256) + 1,
            int((x0 - xs[0]) * 256) : int((x1 - xs[0]) * 256) + 1,
        ]
        px_km = 156543.03 * math.cos(math.radians(lat)) / 2**z / 1000
        return e, px_km

    async def one(client, p):
        lat, lng = float(p["lat"]), float(p["lng"])
        async with sem:
            for attempt in range(3):
                try:
                    r = await client.get(
                        "https://macrostrat.org/api/v2/geologic_units/map",
                        params={"lat": lat, "lng": lng},
                    )
                    units = r.json().get("success", {}).get("data", [])
                    e, px = await terrain_grid(client, lat, lng)
                    break
                except Exception:  # noqa: BLE001
                    await asyncio.sleep(2 + attempt * 3)
            else:
                return
        parts = {
            **F.geology(units),
            **F.magnetics(mag_grid(lat, lng), F.MAG_PX_KM),
            **F.terrain(e, px),
        }
        out.write(
            json.dumps({"id": p["id"], "at": [p["lat"], p["lng"]], "x": F.vector(parts)}) + "\n"
        )

    async with httpx.AsyncClient(timeout=40, headers=UA) as client:
        for i in range(0, len(todo), 200):
            await asyncio.gather(*(one(client, p) for p in todo[i : i + 200]))
            out.flush()
            if len(tiles) > 4000:
                tiles.clear()
            print(f"described {min(i + 200, len(todo))}/{len(todo)}", flush=True)


async def stage_extra(shard: int = 0, shards: int = 1):
    """Gravity (EIGEN-6C4 grid) and mapped faults for every point; run shards in parallel."""
    from geomineral import structure
    from geomineral.schemas import Point

    grav = F.GravityGrid(ROOT / "gravity_fa.npz")
    pts = list(csv.DictReader(open(ROOT / "points.csv")))
    out_file = ROOT / f"features_extra_{shard}.jsonl"
    done = {json.loads(line)["id"] for f in ROOT.glob("features_extra*.jsonl") for line in open(f)}
    todo = [p for p in pts if p["id"] not in done]
    # Neighbouring points share map tiles: sort by tile, give each shard a contiguous slice.
    todo.sort(key=lambda p: structure.tiles_for(float(p["lat"]), float(p["lng"]), 1, 7)[0])
    size = math.ceil(len(todo) / shards)
    todo = todo[shard * size : (shard + 1) * size]
    print("to describe", len(todo), flush=True)
    z = F.FAULT_ZOOM
    cache: dict = {}
    sem = asyncio.Semaphore(4)  # x8 shards stays polite to the tile server
    out = open(out_file, "a")

    async def tile(client, x, y):
        if (x, y) not in cache:
            for attempt in range(3):
                try:
                    r = await client.get(structure.TILES.format(z=z, x=x, y=y))
                    r.raise_for_status()
                    t = structure.mapbox_vector_tile.decode(r.content)
                    cache[(x, y)] = {"lines": t["lines"]} if "lines" in t else {}
                    break
                except Exception:  # noqa: BLE001
                    await asyncio.sleep(2 + 3 * attempt)
            else:
                raise RuntimeError("tile failed")
        return x, y, cache[(x, y)]

    async def one(client, p):
        lat, lng = float(p["lat"]), float(p["lng"])
        async with sem:
            try:
                tiles = [
                    await tile(client, x, y)
                    for x, y in structure.tiles_for(lat, lng, F.WINDOW_KM, z)
                ]
            except RuntimeError:
                return
        found = None
        if any(t for _, _, t in tiles):
            found, _ = structure.parse(tiles, z, Point(lat=lat, lng=lng), F.WINDOW_KM)
        parts = {**F.gravity(grav.window(lat, lng), F.GRAV_PX_KM), **F.faults(found)}
        out.write(
            json.dumps(
                {
                    "id": p["id"],
                    "at": [p["lat"], p["lng"]],
                    "x": [parts[n] for n in F.NAMES[F.BASE :]],
                }
            )
            + chr(10)
        )

    async with httpx.AsyncClient(timeout=40, headers=UA) as client:
        for i in range(0, len(todo), 300):
            await asyncio.gather(*(one(client, p) for p in todo[i : i + 300]))
            out.flush()
            if len(cache) > 6000:
                cache.clear()
            print(f"described {min(i + 300, len(todo))}/{len(todo)}", flush=True)


def stage_train():
    import joblib
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import GroupKFold

    pts = {p["id"]: p for p in csv.DictReader(open(ROOT / "points.csv"))}
    base, extra, located = {}, {}, {}
    for line in open(ROOT / "features.jsonl"):
        d = json.loads(line)
        base[d["id"]] = d["x"][: F.BASE]
        located[d["id"]] = d.get("at")
    for f in ROOT.glob("features_extra*.jsonl"):
        for line in open(f):
            d = json.loads(line)
            extra[d["id"]] = d["x"]
            if d.get("at") and located.get(d["id"]) not in (None, d["at"]):
                located[d["id"]] = ["mismatch"]
    # A row only counts if it was measured at the point's current location.
    where = {i: [p["lat"], p["lng"]] for i, p in pts.items()}
    stale = {i for i, at in located.items() if at is not None and at != where.get(i)}
    feats = {i: base[i] + extra[i] for i in base if i in extra and i not in stale}
    # Magnetics come from the bundled 4-minute grid, the same one live analysis reads.
    mg = F.GravityGrid(MODELS / "magnetics_4min.npz", scale=1)
    mag_cols = [F.NAMES.index(n) for n in F.FAMILY["Magnetics"]]
    for i, x in feats.items():
        m = F.magnetics(mg.window(float(pts[i]["lat"]), float(pts[i]["lng"])), F.MAG_PX_KM)
        for k, n in zip(mag_cols, F.FAMILY["Magnetics"]):
            x[k] = m[n]
    print("stale rows skipped:", len(stale), flush=True)
    ids = [i for i in pts if i in feats]
    X = np.array([feats[i] for i in ids], dtype="float64")
    lat = np.array([float(pts[i]["lat"]) for i in ids])
    lng = np.array([float(pts[i]["lng"]) for i in ids])
    abroad = np.array([pts[i]["abroad"] == "1" for i in ids])
    random_land = np.array([i.startswith("r") for i in ids])
    groups = (np.floor(lat / BLOCK_DEG) * 1000 + np.floor(lng / BLOCK_DEG)).astype(int)
    deposits = json.load(open(ROOT / "deposits.json"))
    minerals = sorted({c for d in deposits for c in d[2]})
    dep_xy = {c: np.array([(d[0], d[1]) for d in deposits if c in d[2]]) for c in minerals}

    def near(c, radius_km):
        """Is each point within radius of a recorded deposit of mineral c?"""
        d = dep_xy[c]
        res = np.zeros(len(ids), dtype=bool)
        if not len(d):
            return res
        for k in range(len(ids)):
            dlat = np.abs(d[:, 0] - lat[k]) * 111
            dlng = np.abs(d[:, 1] - lng[k]) * 111 * math.cos(math.radians(lat[k]))
            res[k] = bool(np.any(np.hypot(dlat, dlng) < radius_km))
        return res

    MODELS.mkdir(parents=True, exist_ok=True)
    report = {}
    for c in minerals:
        pos = np.array([c in pts[i]["minerals"].split("|") for i in ids])
        if pos.sum() < 150:
            continue
        # Negatives: random land and other minerals' deposits, at least 10 km from any c deposit.
        neg = ~near(c, 10) & ~pos
        use = pos | neg
        y = pos[use].astype(int)
        Xc, gc, ab = X[use], groups[use], abroad[use]
        land = random_land[use]

        def fresh():
            return HistGradientBoostingClassifier(
                max_iter=300,
                learning_rate=0.06,
                max_leaf_nodes=24,
                l2_regularization=1.0,
                class_weight="balanced",
            )

        # Full feature set first; the original rock/magnetics/terrain set as a fallback.
        for version, cols in (("v2", list(range(len(F.NAMES)))), ("v1", list(range(F.BASE)))):
            Xv = Xc[:, cols]
            oof = np.full(len(y), np.nan)
            for tr, te in GroupKFold(n_splits=5).split(Xv, y, gc):
                m = fresh()
                m.fit(Xv[tr], y[tr])
                oof[te] = m.predict_proba(Xv[te])[:, 1]
            auc = roc_auc_score(y, oof)
            auc_abroad = (
                roc_auc_score(y[ab], oof[ab])
                if y[ab].sum() > 20 and (1 - y[ab]).sum() > 20
                else None
            )
            ship = auc >= SHIP_AUC and (auc_abroad is None or auc_abroad >= SHIP_AUC - 0.05)
            if ship:
                break
        report[c] = {
            "auc": round(auc, 3),
            "auc_outside_us": auc_abroad and round(auc_abroad, 3),
            "positives": int(y.sum()),
            "negatives": int((1 - y).sum()),
            "shipped": bool(ship),
            "version": version,
        }
        print(c, report[c], flush=True)
        f = MODELS / f"{c.replace(' ', '_').lower()}.joblib"
        if ship:
            m = fresh()
            m.fit(Xv, y)
            # "Top x% of land": rank against held-out random land only, never against other
            # deposits (unusual ground that would make ordinary land look too good).
            joblib.dump(
                {
                    "model": m,
                    "neg": np.sort(oof[(y == 0) & land]),
                    "pos": np.sort(oof[y == 1]),
                    "names": [F.NAMES[k] for k in cols],
                },
                f,
                compress=3,
            )
        elif f.exists():
            f.unlink()
    json.dump(
        {"features": F.NAMES, "block_deg": BLOCK_DEG, "ship_auc": SHIP_AUC, "minerals": report},
        open(MODELS / "report.json", "w"),
        indent=1,
    )


if __name__ == "__main__":
    stage = sys.argv[1]
    if stage == "points":
        stage_points()
    elif stage == "features":
        asyncio.run(stage_features())
    elif stage == "extra":
        asyncio.run(stage_extra(*map(int, sys.argv[2:4])) if len(sys.argv) > 3 else stage_extra())
    elif stage == "train":
        stage_train()
