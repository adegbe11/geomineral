"""Transparent, versioned screening rules; not a calibrated resource model."""

import hashlib
import json
import re

from .schemas import AnalysisRequest, Assessment, Category, Evidence, ProviderResult, now

MODEL_VERSION = "screening-0.2.0"
MISSING = [
    "No verified local assay results",
    "No drilling evidence",
    "No verified local structural or alteration model",
]
# "direct": the mapped rock is itself the commodity. "host": the rock commonly hosts it.
# Terms are matched against a map unit's lithology and name only.
ROCK_RULES = [
    {"commodities": ["Limestone"], "terms": ["limestone"], "kind": "direct"},
    {"commodities": ["Gypsum"], "terms": ["gypsum", "evaporite"], "kind": "direct"},
    {"commodities": ["Clay"], "terms": ["claystone"], "kind": "direct"},
    {"commodities": ["Kaolin"], "terms": ["kaolin"], "kind": "direct"},
    {"commodities": ["Marble"], "terms": ["marble"], "kind": "direct"},
    {"commodities": ["Salt"], "terms": ["halite", "rock salt"], "kind": "direct"},
    {"commodities": ["Aluminium"], "terms": ["bauxite"], "kind": "direct"},
    {
        "commodities": ["Iron"],
        "terms": ["banded iron", "iron formation", "ironstone"],
        "kind": "direct",
    },
    {"commodities": ["Graphite"], "terms": ["graphite", "graphitic"], "kind": "direct"},
    {"commodities": ["Phosphate"], "terms": ["phosphorite"], "kind": "direct"},
    {
        "commodities": ["Gold"],
        "terms": ["greenstone", "metavolcanic", "quartz vein", "turbidite"],
        "kind": "host",
    },
    {
        "commodities": ["Nickel", "Cobalt", "Chromium"],
        "terms": ["ultramafic", "peridotite", "dunite", "serpentinite", "komatiite"],
        "kind": "host",
    },
    {"commodities": ["Copper"], "terms": ["porphyry", "granodiorite", "andesite"], "kind": "host"},
    {"commodities": ["Lithium", "Tin", "Tantalum"], "terms": ["pegmatite"], "kind": "host"},
    {"commodities": ["Tin", "Tungsten"], "terms": ["greisen"], "kind": "host"},
    {"commodities": ["Rare earth elements", "Niobium"], "terms": ["carbonatite"], "kind": "host"},
    {"commodities": ["Diamond"], "terms": ["kimberlite", "lamproite"], "kind": "host"},
    {"commodities": ["Aluminium"], "terms": ["laterite"], "kind": "host"},
]
RANK = {Category.HIGH: 3, Category.MODERATE: 2, Category.LOW: 1, Category.INSUFFICIENT: 0}
NEAR_KM = 5
# Ore fluids often travel along faults; these commodities are commonly fault-controlled.
STRUCTURAL = {
    "Gold",
    "Silver",
    "Copper",
    "Tin",
    "Lithium",
    "Tantalum",
    "Niobium",
    "Lead",
    "Zinc",
    "Tungsten",
    "Uranium",
    "Antimony",
    "Molybdenum",
    "Fluorite",
    "Barite",
}


def _rock_text(e: Evidence) -> str:
    return f"{e.raw_value.get('lith') or ''} {e.raw_value.get('name') or ''}".lower()


def _rock_matches(geology: list[Evidence]) -> dict[str, dict]:
    """commodity -> {"kind": strongest kind, "terms": matched terms, "ids": evidence ids}."""
    found: dict[str, dict] = {}
    for rule in ROCK_RULES:
        for e in geology:
            text = _rock_text(e)
            terms = [t for t in rule["terms"] if t in text]
            if not terms:
                continue
            for commodity in rule["commodities"]:
                hit = found.setdefault(commodity, {"kind": rule["kind"], "terms": [], "ids": []})
                if rule["kind"] == "direct":
                    hit["kind"] = "direct"
                hit["terms"] += [t for t in terms if t not in hit["terms"]]
                if e.id not in hit["ids"]:
                    hit["ids"].append(e.id)
    return found


def _km(m: float) -> str:
    return f"{m / 1000:.1f} km"


def assess(evidence: list[Evidence]) -> list[Assessment]:
    geology = [e for e in evidence if e.evidence_type == "mapped_geology"]
    fault = next((e for e in evidence if e.evidence_type == "structure"), None)
    rocks = _rock_matches(geology)
    candidates = {e.commodity for e in evidence if e.commodity} | set(rocks)
    results = []
    for commodity in candidates:
        related = [e for e in evidence if e.commodity == commodity]
        sites = {}
        for e in related:
            if e.evidence_type == "regional_occurrence":
                sites.setdefault(e.feature_id, e)
        nearest = min(
            (e.distance_m for e in sites.values() if e.distance_m is not None), default=None
        )
        producers = [
            e for e in sites.values() if "producer" in str(e.raw_value.get("dev_stat", "")).lower()
        ]
        negative = [e for e in related if e.direction == "negative"]
        rock = rocks.get(commodity)
        papers = list(
            {e.feature_id: e for e in related if e.evidence_type == "literature"}.values()
        )

        score = 0
        if rock:
            score += 2 if rock["kind"] == "direct" else 1
        if sites:
            score += 1
        if len(sites) >= 3:
            score += 1
        if nearest is not None and nearest <= NEAR_KM * 1000:
            score += 1
        if producers:
            score += 1
        # Studies naming the mineral in title/abstract count fully; full-text mentions alone
        # can only lift a mineral to "possible".
        studied = [e for e in papers if e.raw_value.get("studied")]
        if studied:
            score += 1
        if len(studied) >= 2:
            score += 1
        if papers and not studied and score == 0:
            score = 1
        # A nearby fault strengthens existing evidence; it never creates a candidate alone.
        fault_near = bool(
            score and commodity in STRUCTURAL and fault and fault.raw_value["nearest_km"] <= NEAR_KM
        )
        if fault_near:
            score += 1
        if negative:
            category = Category.INSUFFICIENT
        elif score >= 4:
            category = Category.HIGH
        elif score >= 2:
            category = Category.MODERATE
        elif score == 1:
            category = Category.LOW
        else:
            category = Category.INSUFFICIENT

        parts = []
        if sites:
            noun = "site" if len(sites) == 1 else "sites"
            line = f"{len(sites)} recorded {commodity.lower()} {noun} nearby"
            if nearest is not None:
                line += f", the closest {_km(nearest)} away"
            parts.append(line + ".")
            if producers:
                parts.append(
                    f"{len(producers)} {'was a producing mine' if len(producers) == 1 else 'were producing mines'}."
                )
        if rock:
            rocks_text = ", ".join(rock["terms"])
            parts.append(
                f"Mapped {rocks_text} here is a direct source of {commodity.lower()}."
                if rock["kind"] == "direct"
                else f"Mapped {rocks_text} here commonly hosts {commodity.lower()}."
            )
        if papers:
            place = papers[0].raw_value.get("place", "this place")
            if studied:
                parts.append(
                    f"Studied at {place} in {len(studied)} published "
                    f"{'paper' if len(studied) == 1 else 'papers'}."
                )
            mentions = len(papers) - len(studied)
            if mentions:
                parts.append(
                    f"Mentioned in {mentions} {'more ' if studied else ''}"
                    f"{'paper' if mentions == 1 else 'papers'} about {place}."
                )
        if fault_near:
            parts.append(
                f"A mapped fault {fault.raw_value['nearest_km']:.1f} km away could have channelled "
                f"{commodity.lower()}-bearing fluids."
            )
        if negative:
            parts.append("Contradictory evidence is present and needs professional review.")

        families = sum(bool(x) for x in (rock, sites, studied))
        if families >= 2 and (len(sites) >= 3 or len(studied) >= 2):
            quality = "Good"
        elif families:
            quality = "Limited"
        else:
            quality = "Very Limited"
        results.append(
            Assessment(
                commodity=commodity,
                prospectivity=category,
                evidence_quality=quality,
                explanation=" ".join(parts) or "Reported in a connected source.",
                evidence_ids=[e.id for e in related]
                + (rock["ids"] if rock else [])
                + ([fault.id] if fault_near else []),
                missing=MISSING,
                score=score,
                site_count=len(sites),
                nearest_km=round(nearest / 1000, 1) if nearest is not None else None,
                producer_count=len(producers),
                host_rocks=rock["terms"] if rock else [],
                papers=[
                    {k: e.raw_value.get(k) for k in ("title", "year", "url", "studied")}
                    for e in papers
                ],
            )
        )
    return sorted(
        results, key=lambda a: (-RANK[a.prospectivity], -a.score, -a.site_count, a.commodity)
    )


def _zones(request, assessments, layers, occurrences) -> dict:
    from .zones import build_zones

    spatial = [
        a.commodity
        for a in assessments
        if a.prospectivity != Category.INSUFFICIENT and (a.site_count or a.host_rocks)
    ][:4]
    if not spatial:
        return {"cell_km": None, "by_commodity": {}}
    # Prefer the town name the research step resolved (pins may only have coordinates).
    place = (layers.get("place") or [(request.location.name or "").split(",")[0]])[0]
    return build_zones(
        request.location.lat,
        request.location.lng,
        request.radius_km,
        place,
        spatial,
        layers,
        occurrences,
    )


def build_analysis(request: AnalysisRequest, providers: list[ProviderResult]) -> dict:
    evidence = [e for provider in providers for e in provider.evidence]
    geology = [e for e in evidence if e.evidence_type == "mapped_geology"]
    occurrences = sorted(
        [o for p in providers for o in p.occurrences], key=lambda o: o["distance_m"]
    )
    assessments = assess(evidence)
    # Map layers are large and derived; keep them out of the fingerprinted snapshots.
    snapshots = [provider.model_dump(exclude={"layers"}) for provider in providers]
    layers: dict = {}
    for provider in providers:
        for name, items in provider.layers.items():
            layers.setdefault(name, []).extend(items)
    fingerprint = hashlib.sha256(
        json.dumps(
            {"request": request.model_dump(), "model": MODEL_VERSION, "snapshots": snapshots},
            sort_keys=True,
        ).encode()
    ).hexdigest()
    units = [
        {
            "name": re.sub(r"\s+\d+$", "", str(e.raw_value.get("name") or "").strip())
            or "Unnamed unit",
            "lith": str(e.raw_value.get("lith") or "").strip(),
            "age": str(
                e.raw_value.get("best_int_name") or e.raw_value.get("t_int_name") or ""
            ).strip(),
            "color": str(e.raw_value.get("color") or ""),
            "top_ma": e.raw_value.get("t_age"),
            "bottom_ma": e.raw_value.get("b_age"),
            "reference": str(e.raw_value.get("publication") or ""),
        }
        for e in geology
    ]
    units = list({(u["name"], u["lith"]): u for u in units}.values())
    rated = [a for a in assessments if a.prospectivity != Category.INSUFFICIENT]
    if geology or occurrences:
        lines = []
        if rated:
            top = rated[0]
            lines.append(f"Best signal: {top.commodity} ({top.prospectivity}).")
        sites_checked = any(
            p.source.provider_type == "occurrences" and p.status in ("available", "empty")
            for p in providers
        )
        if occurrences:
            lines.append(
                f"{len(occurrences)} recorded mineral sites within {request.radius_km:g} km."
            )
        elif sites_checked:
            lines.append(f"No recorded mineral sites within {request.radius_km:g} km.")
        else:
            lines.append("Mine records are unavailable right now.")
        if units:
            lines.append(
                "Mapped rocks: "
                + "; ".join(dict.fromkeys((u["lith"] or u["name"])[:60] for u in units[:3]))
                + "."
            )
        summary = " ".join(lines)
    else:
        summary = "Detailed geological information is currently unavailable from our connected sources for this location. There is insufficient evidence to assess local mineral potential."
    return {
        "location": request.location.model_dump(),
        "radius_km": request.radius_km,
        "model_version": MODEL_VERSION,
        "prompt_version": None,
        "created_at": now(),
        "evidence_fingerprint": fingerprint,
        "providers": snapshots,
        "evidence": [e.model_dump() for e in evidence],
        "assessments": [a.model_dump() for a in assessments],
        "occurrences": occurrences,
        "geology_units": units,
        "zones": _zones(request, assessments, layers, occurrences),
        "place": (layers.pop("place", None) or [request.location.name])[0],
        "layers": layers,
        "structure": next(
            (e.raw_value for e in evidence if e.evidence_type == "structure"),
            {"nearest_km": None, "count": 0, "total_km": 0},
        ),
        "rating": rated[0].prospectivity if rated else Category.INSUFFICIENT,
        "summary": summary,
        "coverage": [
            {"name": p.source.dataset_name, "status": p.status, "detail": p.message}
            for p in providers
        ]
        + [
            {"name": name, "status": "unavailable", "detail": "No verified dataset connected"}
            for name in ["Geochemistry", "Geophysics", "Local assays", "Drilling"]
        ],
        "evidence_quality": "Limited" if geology else "Very Limited",
        "limitations": [
            "A screening rating is not proof of a mineral deposit.",
            "Regional map scale and historical records limit local conclusions.",
            "No inference about grade, tonnage, economic viability, land access or mineral rights is made.",
            "Missing records are not evidence of mineral absence.",
        ],
        "next_steps": [
            "Review the original geological maps and their scale.",
            "Verify land access, mineral rights and local requirements with the responsible authorities.",
            "If legally permitted, record non-invasive field observations with coordinates.",
            "Consult a qualified geologist before sampling or further exploration.",
        ],
    }
