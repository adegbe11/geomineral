"""Conservative, versioned screening rules; not a calibrated resource model."""

import hashlib
import json

from .schemas import AnalysisRequest, Assessment, Category, Evidence, ProviderResult, now

MODEL_VERSION = "screening-0.1.0"
MISSING = [
    "No verified local assay results",
    "No drilling evidence",
    "No verified local structural or alteration model",
]
# These are candidate-generation rules only, not a universal deposit score.
COMMODITY_RULES = {
    "Limestone": {
        "terms": ["limestone"],
        "reason": "A source maps limestone, which warrants checking its composition and suitability locally.",
    },
    "Gypsum": {
        "terms": ["gypsum"],
        "reason": "A source explicitly describes gypsum-bearing material; extent and quality remain unverified.",
    },
    "Clay": {
        "terms": ["claystone"],
        "reason": "A mapped clay-rich rock may justify characterization; industrial suitability is unknown.",
    },
}


def assess(evidence: list[Evidence]) -> list[Assessment]:
    candidates = {e.commodity for e in evidence if e.commodity}
    geology = [e for e in evidence if e.evidence_type == "mapped_geology"]
    for commodity, rule in COMMODITY_RULES.items():
        if any(
            any(term in str(e.raw_value.get("lith", "")).lower() for term in rule["terms"])
            for e in geology
        ):
            candidates.add(commodity)
    results = []
    for commodity in sorted(candidates):
        related = [e for e in evidence if e.commodity == commodity]
        rule = COMMODITY_RULES.get(commodity)
        host = [
            e
            for e in geology
            if rule
            and any(term in str(e.raw_value.get("lith", "")).lower() for term in rule["terms"])
        ]
        negative = [e for e in related if e.direction == "negative"]
        # Regional occurrences alone cannot justify a local prospectivity category.
        category = Category.MODERATE if host and not negative else Category.INSUFFICIENT
        explanation = (
            rule["reason"]
            if host and rule
            else "Nearby reported occurrences provide regional context, but do not establish favorable conditions at the selected location."
        )
        if negative:
            explanation += " Contradictory evidence is present and requires professional review."
        results.append(
            Assessment(
                commodity=commodity,
                prospectivity=category,
                evidence_quality="Limited" if host else "Very Limited",
                explanation=explanation,
                evidence_ids=[e.id for e in related + host],
                missing=MISSING,
            )
        )
    return results


def build_analysis(request: AnalysisRequest, providers: list[ProviderResult]) -> dict:
    evidence = [e for provider in providers for e in provider.evidence]
    geology = [e for e in evidence if e.evidence_type == "mapped_geology"]
    snapshots = [provider.model_dump() for provider in providers]
    fingerprint = hashlib.sha256(
        json.dumps(
            {"request": request.model_dump(), "model": MODEL_VERSION, "snapshots": snapshots},
            sort_keys=True,
        ).encode()
    ).hexdigest()
    return {
        "location": request.location.model_dump(),
        "radius_km": request.radius_km,
        "model_version": MODEL_VERSION,
        "prompt_version": None,
        "created_at": now(),
        "evidence_fingerprint": fingerprint,
        "providers": snapshots,
        "evidence": [e.model_dump() for e in evidence],
        "assessments": [a.model_dump() for a in assess(evidence)],
        "occurrences": sorted(
            [o for p in providers for o in p.occurrences], key=lambda o: o["distance_m"]
        ),
        "summary": (
            "Connected maps report: "
            + "; ".join(
                dict.fromkeys(str(e.raw_value.get("name", "Unnamed unit")) for e in geology)
            )
            + ". These map units describe regional geology, not confirmed mineral deposits."
        )
        if geology
        else "Detailed geological information is currently unavailable from our connected sources for this location. There is insufficient evidence to assess local mineral potential.",
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
            "A prospectivity assessment is not proof of a mineral deposit.",
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
