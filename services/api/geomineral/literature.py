"""Published-research evidence: which minerals are written about at this place.

GeoMineral is not told anything about specific places. For any point it finds the
local place name, searches OpenAlex (250M+ scholarly works, no key) for geology
papers that mention that place together with a mineral, and returns each hit as
cited evidence. Agricultural, soil, water and health papers are excluded so a
paper about copper in cocoa leaves never becomes copper evidence.
"""

import asyncio
import os
import re
import time

import httpx

from .schemas import Evidence, Point, ProviderResult, Source

OPENALEX = Source(
    id="openalex",
    provider_name="OpenAlex",
    provider_type="literature",
    dataset_name="Published geological research",
    source_url="https://openalex.org",
    api_url="https://api.openalex.org/works",
    licence="CC0 metadata; linked papers keep their own licences",
    commercial_use_allowed=True,
    resolution="Place-name level; a mention is not a measured location",
    notes="Mentions in published work, filtered to geology titles. Not proof of a deposit.",
)
# Search phrase -> commodity name used by the screening model.
TERMS = {
    "gold": "Gold",
    "silver": "Silver",
    "copper": "Copper",
    "cassiterite": "Tin",
    '"tin ore"': "Tin",
    "columbite": "Niobium",
    "tantalite": "Tantalum",
    "lithium": "Lithium",
    "spodumene": "Lithium",
    "galena": "Lead",
    '"lead-zinc"': "Zinc",
    "sphalerite": "Zinc",
    '"iron ore"': "Iron",
    "magnetite": "Iron",
    "bauxite": "Aluminium",
    "gypsum": "Gypsum",
    "limestone": "Limestone",
    "marble": "Marble",
    "kaolin": "Kaolin",
    "clay": "Clay",
    "barite": "Barite",
    "baryte": "Barite",
    "feldspar": "Feldspar",
    "talc": "Talc",
    "graphite": "Graphite",
    "manganese": "Manganese",
    "nickel": "Nickel",
    "chromite": "Chromium",
    "uranium": "Uranium",
    '"rare earth"': "Rare earth elements",
    "monazite": "Rare earth elements",
    "diamond": "Diamond",
    "tourmaline": "Gemstones",
    "coal": "Coal",
    "phosphate": "Phosphate",
    "wolframite": "Tungsten",
    "bitumen": "Bitumen",
}
GEOLOGY = re.compile(
    r"geolog|mineral|\brock|deposit|\bores?\b|mining|\bmine\b|quarr|petrolog|petrograph|"
    r"lithol|stratigraph|sediment|basement|pegmatit|granit|shale|limestone|gypsum|kaolin|"
    r"\bclays?\b|marble|gold|tin\b|columbite|geophysic|geochemi|aeromagnetic|refractory|"
    r"raw material|industrial|ceramic|cement|outcrop|basin|formation\b|tectonic|structural",
    re.I,
)
EXCLUDE = re.compile(
    r"\bsoils?\b|groundwater|water\b|cocoa|cacao|plantation|crop|nutrient|fertili|"
    r"maize|cassava|health|disease|malaria|patient|hospital|livestock|fish|parent material",
    re.I,
)
GENERIC_NAMES = re.compile(
    r"^(-?\d+(\.\d+)?, ?-?\d+(\.\d+)?|Selected map location|Current location|Area vertex)$"
)
_cache: dict[str, tuple[float, list[Evidence], str]] = {}
CACHE_SECONDS = 7 * 86400


def relevant(title: str) -> bool:
    return bool(GEOLOGY.search(title)) and not EXCLUDE.search(title)


def abstract(work: dict) -> str:
    inv = work.get("abstract_inverted_index") or {}
    return " ".join(t for _, t in sorted((p, t) for t, ps in inv.items() for p in ps))


def word(term: str) -> re.Pattern:
    return re.compile(r"\b" + re.escape(term.strip('"')) + r"\w*", re.I)


async def place_name(client: httpx.AsyncClient, point: Point) -> str:
    """Most local name for the point: given name, else town/village from OpenStreetMap."""
    first = (point.name or "").split(",")[0].strip()
    if first and not GENERIC_NAMES.match(point.name or ""):
        return first
    try:
        r = await client.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": point.lat, "lon": point.lng, "format": "jsonv2", "zoom": 14},
        )
        r.raise_for_status()
        a = r.json().get("address", {})
    except (httpx.HTTPError, ValueError):
        return ""
    for key in ("village", "town", "city", "municipality", "suburb", "county"):
        if a.get(key):
            return str(a[key])
    return ""


class Limited(Exception):
    """OpenAlex daily budget used up."""


def _params(extra: dict) -> dict:
    key = os.getenv("OPENALEX_API_KEY", "")
    return {**extra, **({"api_key": key} if key else {})}


async def _search(client, sem, query: str, per_page: int):
    async with sem:
        r = await client.get(
            OPENALEX.api_url,
            params=_params(
                {
                    "search": query,
                    "per-page": per_page,
                    "select": "id,display_name,publication_year,doi,abstract_inverted_index",
                }
            ),
        )
        if r.status_code == 429:
            raise Limited()
        r.raise_for_status()
        return r.json().get("results", [])


class LiteratureProvider:
    source = OPENALEX

    async def fetch(
        self, client: httpx.AsyncClient, location: Point, radius_km: float
    ) -> ProviderResult:
        name = await place_name(client, location)
        if len(name) < 3:
            return ProviderResult(
                source=self.source,
                status="empty",
                message="No place name here to search published research for.",
            )
        key = name.lower()
        if key in _cache and _cache[key][0] > time.monotonic() - CACHE_SECONDS:
            _, evidence, msg = _cache[key]
            return ProviderResult(
                source=self.source,
                status="available" if evidence else "empty",
                evidence=evidence,
                message=msg,
                layers={"place": [name]},
            )
        sem = asyncio.Semaphore(4)
        anchor = word(name)
        found: dict[tuple[str, str], tuple[dict, bool]] = {}

        def keep(work: dict, term: str, studied: bool):
            text = f"{work.get('display_name') or ''} {abstract(work)}"
            # The place must be in the title or abstract, not only an author or reference.
            if relevant(work.get("display_name") or "") and anchor.search(text):
                k = (TERMS[term], work["id"])
                if k not in found or (studied and not found[k][1]):
                    found[k] = (work, studied)

        try:
            # One search for the place; minerals in titles and abstracts count as studied.
            for work in await _search(client, sem, f'"{name}"', 50):
                text = f"{work.get('display_name') or ''} {abstract(work)}"
                for term in TERMS:
                    if word(term).search(text):
                        keep(work, term, True)
            # With a key, also search full texts mineral by mineral for passing mentions.
            if os.getenv("OPENALEX_API_KEY"):
                hits = await asyncio.gather(
                    *(_search(client, sem, f'"{name}" {term}', 10) for term in TERMS),
                    return_exceptions=True,
                )
                for term, works in zip(TERMS, hits):
                    if isinstance(works, Limited):
                        raise works
                    if isinstance(works, Exception):
                        continue
                    for work in works:
                        text = f"{work.get('display_name') or ''} {abstract(work)}"
                        keep(work, term, bool(word(term).search(text)))
        except Limited:
            return ProviderResult(
                source=self.source,
                status="unavailable",
                message="The free daily research allowance is used up. It resets at midnight UTC.",
                layers={"place": [name]},
            )
        evidence = []
        per_mineral: dict[str, int] = {}
        for (commodity, _), (w, studied) in sorted(
            found.items(), key=lambda kv: (not kv[1][1], -(kv[1][0].get("publication_year") or 0))
        ):
            if per_mineral.get(commodity, 0) >= 3:
                continue
            per_mineral[commodity] = per_mineral.get(commodity, 0) + 1
            title = (w.get("display_name") or "Untitled").strip()
            year = w.get("publication_year")
            evidence.append(
                Evidence(
                    id=f"openalex:{w['id'].rsplit('/', 1)[-1]}:{commodity}",
                    source_id=self.source.id,
                    feature_id=w["id"],
                    evidence_type="literature",
                    commodity=commodity,
                    direction="positive",
                    observed_or_inferred="reported",
                    reliability="Published mention; location is the named place, not a point",
                    strength="moderate" if studied else "weak",
                    description=(
                        f"“{title}” ({year}) "
                        + ("studies" if studied else "mentions")
                        + f" {commodity.lower()} at {name}."
                    ),
                    raw_value={
                        "title": title,
                        "year": year,
                        "url": w.get("doi") or w["id"],
                        "place": name,
                        "studied": studied,
                    },
                )
            )
        msg = f"Searched published geology research for {name}."
        _cache[key] = (time.monotonic(), evidence, msg)
        return ProviderResult(
            source=self.source,
            status="available" if evidence else "empty",
            evidence=evidence,
            message=msg,
            layers={"place": [name]},
        )
