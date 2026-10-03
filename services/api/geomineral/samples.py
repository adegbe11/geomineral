"""The user's own field samples near a pin, as evidence.

Lab-confirmed samples are strong, positioned evidence. Suspected identifications
(visual or AI) are listed for context but never raise a rating on their own.
"""

import json

from sqlalchemy import select

from .db import FieldRecord, Project
from .geo import distance_m
from .schemas import Evidence, Point

# Sample name (mineral or rock) -> commodity used by the screening model.
COMMODITY = {
    "gold": "Gold",
    "native gold": "Gold",
    "arsenopyrite": "Gold",
    "silver": "Silver",
    "copper": "Copper",
    "chalcopyrite": "Copper",
    "bornite": "Copper",
    "malachite": "Copper",
    "azurite": "Copper",
    "chrysocolla": "Copper",
    "galena": "Lead",
    "sphalerite": "Zinc",
    "smithsonite": "Zinc",
    "cassiterite": "Tin",
    "columbite": "Niobium",
    "tantalite": "Tantalum",
    "spodumene": "Lithium",
    "lepidolite": "Lithium",
    "pegmatite": "Lithium",
    "magnetite": "Iron",
    "hematite": "Iron",
    "goethite": "Iron",
    "limonite": "Iron",
    "siderite": "Iron",
    "ironstone": "Iron",
    "bauxite": "Aluminium",
    "laterite": "Aluminium",
    "gypsum": "Gypsum",
    "selenite": "Gypsum",
    "limestone": "Limestone",
    "calcite": "Limestone",
    "dolomite": "Limestone",
    "marble": "Marble",
    "kaolinite": "Kaolin",
    "kaolin": "Kaolin",
    "clay": "Clay",
    "shale": "Clay",
    "mudstone": "Clay",
    "barite": "Barite",
    "fluorite": "Fluorite",
    "graphite": "Graphite",
    "chromite": "Chromium",
    "pentlandite": "Nickel",
    "pyrrhotite": "Nickel",
    "cinnabar": "Mercury",
    "stibnite": "Antimony",
    "wolframite": "Tungsten",
    "molybdenite": "Molybdenum",
    "monazite": "Rare earth elements",
    "diamond": "Diamond",
    "kimberlite": "Diamond",
    "coal": "Coal",
    "talc": "Talc",
    "pyrolusite": "Manganese",
    "rutile": "Titanium",
    "ilmenite": "Titanium",
    "zircon": "Zirconium",
    "beryl": "Beryllium",
    "emerald": "Gemstones",
    "tourmaline": "Gemstones",
    "garnet": "Gemstones",
    "amethyst": "Gemstones",
    "corundum": "Gemstones",
    "topaz": "Gemstones",
}


def commodity_for(name: str) -> str | None:
    return COMMODITY.get((name or "").strip().lower())


def nearby_samples(db, user_id: str, point: Point, radius_km: float) -> list[Evidence]:
    rows = db.execute(
        select(FieldRecord.id, FieldRecord.payload, Project.name)
        .join(Project, FieldRecord.project_id == Project.id)
        .where(Project.owner_id == user_id)
    ).all()
    evidence = []
    for rid, payload, project in rows:
        rec = json.loads(payload)
        commodity = commodity_for(rec.get("rock_type", ""))
        loc = rec.get("location") or {}
        if not commodity or "lat" not in loc:
            continue
        d = distance_m((point.lng, point.lat), (loc["lng"], loc["lat"]))
        if d > radius_km * 1000:
            continue
        confirmed = "lab-confirmed" in str(rec.get("method", "")).lower()
        evidence.append(
            Evidence(
                id=f"sample:{rid}:{commodity}",
                source_id="your-samples",
                feature_id=rid,
                evidence_type="field_sample",
                commodity=commodity,
                direction="positive" if confirmed else "context",
                strength="strong" if confirmed else "weak",
                observed_or_inferred="observed" if confirmed else "inferred",
                reliability="Your laboratory-confirmed sample"
                if confirmed
                else "Your suspected identification; not confirmed",
                distance_m=round(d),
                description=f"{rec.get('title', 'Sample')} ({project}): "
                f"{'lab-confirmed' if confirmed else 'suspected'} {rec.get('rock_type')}, "
                f"{d / 1000:.1f} km from the pin.",
                raw_value={
                    "title": rec.get("title", "Sample"),
                    "rock_type": rec.get("rock_type"),
                    "confirmed": confirmed,
                    "lat": loc["lat"],
                    "lng": loc["lng"],
                    "distance_km": round(d / 1000, 1),
                    "project": project,
                },
            )
        )
    return evidence
