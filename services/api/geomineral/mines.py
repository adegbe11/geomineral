"""Known mines anywhere on Earth, from Wikidata (CC0, no key).

Mines inside the radius are recorded sites. Mines further out, up to REGION_KM, say what
the surrounding region produces; they can lift a mineral to "possible" and no further.
"""

import asyncio
import time

import httpx

from .geo import distance_m
from .samples import COMMODITY
from .schemas import Evidence, ProviderResult, Source

WIKIDATA = Source(
    id="wikidata-mines",
    provider_name="Wikidata",
    provider_type="occurrences",
    dataset_name="Known mines worldwide",
    source_url="https://www.wikidata.org",
    api_url="https://query.wikidata.org/sparql",
    licence="CC0",
    commercial_use_allowed=True,
    resolution="Point locations of notable mines; coverage varies by country",
    notes="Community-maintained. A listed mine does not establish current activity.",
)
REGION_KM = 100
_cache: dict[tuple, tuple[float, list]] = {}
# Product label (lowercase, without "ore") -> commodity, beyond the mineral names in COMMODITY.
PRODUCTS = {
    "lignite": "Coal",
    "bituminous coal": "Coal",
    "anthracite": "Coal",
    "aluminium": "Aluminium",
    "aluminum": "Aluminium",
    "lead": "Lead",
    "zinc": "Zinc",
    "nickel": "Nickel",
    "cobalt": "Cobalt",
    "tin": "Tin",
    "tungsten": "Tungsten",
    "uranium": "Uranium",
    "lithium": "Lithium",
    "manganese": "Manganese",
    "platinum": "Platinum",
    "phosphate": "Phosphate",
    "phosphate rock": "Phosphate",
    "salt": "Salt",
    "iron": "Iron",
    "sand": "Sand and gravel",
    "gravel": "Sand and gravel",
    "granite": "Crushed stone",
    "crushed stone": "Crushed stone",
    "slate": "Dimension stone",
}
QUERY = """SELECT ?m ?mLabel ?loc (GROUP_CONCAT(DISTINCT ?pLabel; separator="|") AS ?products)
WHERE {
  SERVICE wikibase:around {
    ?m wdt:P625 ?loc.
    bd:serviceParam wikibase:center "Point(%f %f)"^^geo:wktLiteral; wikibase:radius "%d".
  }
  ?m wdt:P31/wdt:P279* ?kind. VALUES ?kind { wd:Q820477 wd:Q188040 wd:Q1323233 }
  OPTIONAL { ?m wdt:P1056 ?p. ?p rdfs:label ?pLabel. FILTER(lang(?pLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} GROUP BY ?m ?mLabel ?loc LIMIT 200"""


def commodity_of(label: str) -> str | None:
    name = label.lower().replace(" ore", "").replace(" concentrate", "").strip()
    return COMMODITY.get(name) or PRODUCTS.get(name)


def _point(wkt: str) -> tuple[float, float]:
    lng, lat = wkt.removeprefix("Point(").rstrip(")").split()
    return float(lng), float(lat)


class WikidataMinesProvider:
    source = WIKIDATA

    async def fetch(self, client: httpx.AsyncClient, location, radius_km):
        region = max(radius_km, REGION_KM)
        key = (round(location.lat, 3), round(location.lng, 3), region)
        if key in _cache and _cache[key][0] > time.time() - 86400:
            rows = _cache[key][1]
        else:
            for attempt in range(2):
                r = await client.get(
                    self.source.api_url,
                    params={
                        "query": QUERY % (location.lng, location.lat, region),
                        "format": "json",
                    },
                    headers={"Accept": "application/sparql-results+json"},
                )
                if r.status_code != 429 or attempt:
                    break
                await asyncio.sleep(2)
            r.raise_for_status()
            rows = r.json()["results"]["bindings"]
            _cache[key] = (time.time(), rows)
        evidence, occurrences = [], []
        for row in rows:
            qid = row["m"]["value"].rsplit("/", 1)[-1]
            name = row.get("mLabel", {}).get("value") or "Unnamed mine"
            x, y = _point(row["loc"]["value"])
            d = distance_m((location.lng, location.lat), (x, y))
            labels = [p for p in row.get("products", {}).get("value", "").split("|") if p]
            commodities = sorted({c for c in map(commodity_of, labels) if c})
            inside = d <= radius_km * 1000
            if inside:
                occurrences.append(
                    {
                        "id": qid,
                        "name": name,
                        "status": "Mine",
                        "commodities": commodities,
                        "distance_m": round(d),
                        "lat": y,
                        "lng": x,
                        "source_id": self.source.id,
                        "url": f"https://www.wikidata.org/wiki/{qid}",
                        "raw": {"products": labels},
                    }
                )
            for commodity in commodities:
                evidence.append(
                    Evidence(
                        id=f"wikidata:{qid}:{commodity}",
                        source_id=self.source.id,
                        feature_id=qid,
                        evidence_type="regional_occurrence" if inside else "regional_mine",
                        commodity=commodity,
                        direction="positive",
                        description=f"{name} mines {commodity.lower()}, {d / 1000:.0f} km "
                        "from the selected point. This does not establish mineralization "
                        "at the point.",
                        distance_m=round(d),
                        raw_value={"name": name, "products": labels, "dev_stat": "Mine"},
                    )
                )
        occurrences.sort(key=lambda o: o["distance_m"])
        return ProviderResult(
            source=self.source,
            status="available" if evidence or occurrences else "empty",
            evidence=evidence,
            occurrences=occurrences,
            message=f"Known mines within {region:g} km.",
        )
