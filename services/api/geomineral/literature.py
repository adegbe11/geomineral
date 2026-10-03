"""Published-research evidence: which minerals are written about at this place.

GeoMineral is not told anything about specific places. For any point it finds the
local place name, searches OpenAlex (250M+ scholarly works, no key) for geology
papers that mention that place together with a mineral, and returns each hit as
cited evidence. Agricultural, soil, water and health papers are excluded so a
paper about copper in cocoa leaves never becomes copper evidence.
"""

import asyncio
import json
import os
import re
import time
from pathlib import Path

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
# name -> (unix time, [[work, term, studied], ...]); on disk so restarts keep the budget.
_cache: dict[str, tuple[float, list]] = {}
CACHE_SECONDS = 7 * 86400
CROSSREF_URL = "https://api.crossref.org/works"


def relevant(title: str) -> bool:
    return bool(GEOLOGY.search(title)) and not EXCLUDE.search(title)


def abstract(work: dict) -> str:
    if "_abstract" in work:
        return work["_abstract"]
    inv = work.get("abstract_inverted_index") or {}
    return " ".join(t for _, t in sorted((p, t) for t, ps in inv.items() for p in ps))


def word(term: str) -> re.Pattern:
    return re.compile(r"\b" + re.escape(term.strip('"')) + r"\w*", re.I)


def _cache_file() -> Path | None:
    path = os.getenv("RESEARCH_CACHE", ".data/research-cache.json")
    return Path(path) if path else None


def _load_cache():
    f = _cache_file()
    if _cache or not f or not f.exists():
        return
    try:
        _cache.update({k: tuple(v) for k, v in json.loads(f.read_text("utf-8")).items()})
    except (OSError, ValueError):
        pass


def _save_cache():
    f = _cache_file()
    if not f:
        return
    try:
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps(_cache), "utf-8")
    except OSError:
        pass


async def place_names(client: httpx.AsyncClient, point: Point) -> list[str]:
    """Local names to search, most local first: nearest village/town, given name, district."""
    given = (point.name or "").split(",")[0].strip()
    if GENERIC_NAMES.match(point.name or ""):
        given = ""
    local = district = ""
    try:
        r = await client.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": point.lat, "lon": point.lng, "format": "jsonv2", "zoom": 14},
        )
        r.raise_for_status()
        a = r.json().get("address", {})
        local = next(
            (str(a[k]) for k in ("village", "town", "city", "hamlet", "suburb") if a.get(k)), ""
        )
        district = next(
            (str(a[k]) for k in ("county", "municipality", "state_district") if a.get(k)), ""
        )
    except (httpx.HTTPError, ValueError):
        pass
    names = []
    for n in (local, given, district):
        if len(n) >= 3 and n.lower() not in [x.lower() for x in names]:
            names.append(n)
    return names[:3]


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


async def _crossref(client, name: str) -> list[dict]:
    """Backup index with no daily cap; works are shaped like OpenAlex results."""
    r = await client.get(
        CROSSREF_URL,
        params={"query.bibliographic": name, "rows": 60, "select": "DOI,title,abstract,issued"},
    )
    r.raise_for_status()
    works = []
    for it in r.json().get("message", {}).get("items", []):
        doi = it.get("DOI")
        if not doi:
            continue
        year = ((it.get("issued") or {}).get("date-parts") or [[None]])[0][0]
        works.append(
            {
                "id": f"https://doi.org/{doi}",
                "display_name": (it.get("title") or [""])[0],
                "publication_year": year,
                "doi": f"https://doi.org/{doi}",
                "_abstract": re.sub(r"<[^>]+>", " ", it.get("abstract") or ""),
            }
        )
    return works


async def _research(client, sem, name: str) -> tuple[list, bool]:
    """([[work, term, studied], ...], whether the main index answered) for one place name."""
    anchor = word(name)
    found: dict[tuple[str, str], tuple[dict, str, bool]] = {}

    def keep(work: dict, term: str, studied: bool):
        text = f"{work.get('display_name') or ''} {abstract(work)}"
        # The place must be in the title or abstract, not only an author or reference.
        if relevant(work.get("display_name") or "") and anchor.search(text):
            k = (TERMS[term], work["id"])
            if k not in found or (studied and not found[k][2]):
                slim = {x: work.get(x) for x in ("id", "display_name", "publication_year", "doi")}
                found[k] = (slim, term, studied)

    def scan(works):
        for work in works:
            text = f"{work.get('display_name') or ''} {abstract(work)}"
            for term in TERMS:
                if word(term).search(text):
                    keep(work, term, True)

    try:
        # One search for the place; minerals in titles and abstracts count as studied.
        scan(await _search(client, sem, f'"{name}"', 50))
        # With a key, also search full texts mineral by mineral for passing mentions.
        if os.getenv("OPENALEX_API_KEY"):
            hits = await asyncio.gather(
                *(_search(client, sem, f'"{name}" {term}', 10) for term in TERMS),
                return_exceptions=True,
            )
            for term, works in zip(TERMS, hits):
                if isinstance(works, Exception):
                    continue
                for work in works:
                    text = f"{work.get('display_name') or ''} {abstract(work)}"
                    keep(work, term, bool(word(term).search(text)))
    except Limited:
        scan(await _crossref(client, name))
        return [[w, t, st] for w, t, st in found.values()], False
    return [[w, t, st] for w, t, st in found.values()], True


class LiteratureProvider:
    source = OPENALEX

    async def fetch(
        self, client: httpx.AsyncClient, location: Point, radius_km: float
    ) -> ProviderResult:
        names = await place_names(client, location)
        if not names:
            return ProviderResult(
                source=self.source,
                status="empty",
                message="No place name here to search published research for.",
            )
        _load_cache()
        sem = asyncio.Semaphore(4)
        hits_by_name: dict[str, list] = {}
        failed = 0
        for name in names:
            key = name.lower()
            if key in _cache and _cache[key][0] > time.time() - CACHE_SECONDS:
                hits_by_name[name] = _cache[key][1]
                continue
            try:
                hits_by_name[name], full = await _research(client, sem, name)
            except (httpx.HTTPError, ValueError):
                failed += 1
                continue
            # Backup-only answers are retried after six hours, once the main index resets.
            stamp = time.time() if full else time.time() - CACHE_SECONDS + 6 * 3600
            _cache[key] = (stamp, hits_by_name[name])
        _save_cache()
        if failed == len(names):
            return ProviderResult(
                source=self.source,
                status="unavailable",
                message="Research libraries could not be reached. Try again later.",
                layers={"place": names[:1]},
            )
        # The most local name wins; a paper is used once per mineral.
        evidence, seen = [], set()
        per_mineral: dict[str, int] = {}
        for name in names:
            rows = sorted(
                hits_by_name.get(name, []),
                key=lambda h: (not h[2], -(h[0].get("publication_year") or 0)),
            )
            for w, term, studied in rows:
                commodity = TERMS[term]
                if (commodity, w["id"]) in seen or per_mineral.get(commodity, 0) >= 3:
                    continue
                seen.add((commodity, w["id"]))
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
        return ProviderResult(
            source=self.source,
            status="available" if evidence else "empty",
            evidence=evidence,
            message=f"Searched published geology research for {', '.join(names)}.",
            layers={"place": names[:1]},
        )
