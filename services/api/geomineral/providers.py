"""Public source adapters. A failed request never becomes an empty dataset."""

import asyncio
import logging
import math
import re
from typing import Protocol
from xml.etree import ElementTree

import httpx

from .config import LIVE_PROVIDERS, USER_AGENT
from .geo import distance_m
from .literature import OPENALEX, LiteratureProvider
from .schemas import Evidence, Point, ProviderResult, Source
from .structure import STRUCTURE, StructureProvider

log = logging.getLogger(__name__)
MACROSTRAT = Source(
    id="macrostrat",
    provider_name="Macrostrat",
    provider_type="geology",
    dataset_name="Integrated geological maps",
    source_url="https://macrostrat.org",
    api_url="https://macrostrat.org/api/v2/geologic_units/map",
    licence="CC BY 4.0",
    commercial_use_allowed=True,
    resolution="Varies by original map; regional maps are not property surveys",
    notes="Original map citations retained per feature. Overlapping maps can disagree.",
)
MRDS = Source(
    id="usgs-mrds",
    provider_name="U.S. Geological Survey",
    provider_type="occurrences",
    dataset_name="Mineral Resources Data System (MRDS)",
    source_url="https://mrdata.usgs.gov/mrds/",
    api_url="https://energy.usgs.gov/arcgis/rest/services/MRData/Mineral_Resource_Data_System/MapServer/3/query",
    licence="USGS public-domain data; linked third-party documents retain their rights",
    commercial_use_allowed=True,
    resolution="Point locations; positional accuracy varies by record",
    notes="Historical compilation. Records may be incomplete or outdated; a mine record does not establish current activity.",
)
SOURCES = [MACROSTRAT, MRDS, OPENALEX, STRUCTURE]
WFS_URL = "https://mrdata.usgs.gov/services/wfs/mrds"
MS_NS = "http://mapserver.gis.umn.edu/mapserver"
GML_NS = "http://www.opengis.net/gml"
COMMODITY_CODES = {
    "AU": "Gold",
    "AG": "Silver",
    "CU": "Copper",
    "LI": "Lithium",
    "NI": "Nickel",
    "CO": "Cobalt",
    "FE": "Iron",
    "SN": "Tin",
    "TA": "Tantalum",
    "REE": "Rare earth elements",
    "U": "Uranium",
    "GRA": "Graphite",
    "LST": "Limestone",
    "CLY": "Clay",
    "KAO": "Kaolin",
    "GYP": "Gypsum",
    "AL": "Aluminium",
    "DIA": "Diamond",
    "PB": "Lead",
    "ZN": "Zinc",
    "MO": "Molybdenum",
    "W": "Tungsten",
    "MN": "Manganese",
    "CR": "Chromium",
    "PT": "Platinum",
    "PGE": "Platinum",
    "V": "Vanadium",
    "TI": "Titanium",
    "BE": "Beryllium",
    "NB": "Niobium",
    "SB": "Antimony",
    "BI": "Bismuth",
    "HG": "Mercury",
    "ZR": "Zirconium",
    "FLR": "Fluorite",
    "BRT": "Barite",
    "PHO": "Phosphate",
    "SLT": "Salt",
    "TLC": "Talc",
    "MCA": "Mica",
    "FLD": "Feldspar",
    "SIL": "Silica",
    "MRB": "Marble",
    "GEM": "Gemstones",
}


class GeologyProvider(Protocol):
    source: Source

    async def fetch(
        self, client: httpx.AsyncClient, location: Point, radius_km: float
    ) -> ProviderResult: ...


class MineralOccurrenceProvider(GeologyProvider, Protocol):
    pass


class MacrostratProvider:
    source = MACROSTRAT

    async def fetch(self, client, location, radius_km):
        response = await client.get(
            self.source.api_url, params={"lat": location.lat, "lng": location.lng}
        )
        response.raise_for_status()
        payload = response.json()["success"]
        evidence = []
        for row in payload["data"][:20]:
            raw = dict(row)
            raw["publication"] = payload.get("refs", {}).get(
                str(row.get("source_id")), "Not supplied"
            )
            evidence.append(
                Evidence(
                    id=f"macrostrat:{row['map_id']}",
                    source_id=self.source.id,
                    feature_id=str(row["map_id"]),
                    evidence_type="mapped_geology",
                    description=f"{row.get('name') or 'Mapped geological unit'}: {row.get('descrip') or row.get('lith') or 'No lithology description supplied.'}",
                    raw_value=raw,
                )
            )
        return ProviderResult(
            source=self.source,
            status="available" if evidence else "empty",
            evidence=evidence,
            message="Overlapping map units are retained; map scale limits local interpretation.",
        )


class USGSOccurrenceProvider:
    source = MRDS

    async def fetch(self, client, location, radius_km):
        try:
            features, truncated = await self._arcgis(client, location, radius_km)
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            # The ArcGIS mirror is often down; the WFS service carries the same records.
            log.info("mrds_arcgis_failed error=%s; using WFS", type(exc).__name__)
            features, truncated = await self._wfs(client, location, radius_km)
        return self._build(features, truncated, location, radius_km)

    async def _arcgis(self, client, location, radius_km):
        response = await client.get(
            self.source.api_url,
            params={
                "f": "json",
                "where": "1=1",
                "geometry": f"{location.lng},{location.lat}",
                "geometryType": "esriGeometryPoint",
                "inSR": 4326,
                "outSR": 4326,
                "distance": radius_km * 1000,
                "units": "esriSRUnit_Meter",
                "spatialRel": "esriSpatialRelIntersects",
                "outFields": "dep_id,site_name,dev_stat,code_list,url,grade",
                "returnGeometry": "true",
                "resultRecordCount": 250,
                "orderByFields": "dep_id",
            },
        )
        response.raise_for_status()
        payload = response.json()
        if "error" in payload:
            raise ValueError("Occurrence service rejected the query")
        features = [
            (f["attributes"], f["geometry"]["x"], f["geometry"]["y"])
            for f in payload["features"]
            if f.get("geometry")
        ]
        return features, bool(payload.get("exceededTransferLimit"))

    async def _wfs(self, client, location, radius_km):
        dlat = radius_km / 111.0
        dlng = radius_km / max(111.0 * math.cos(math.radians(location.lat)), 1.0)
        bbox = (
            max(location.lat - dlat, -90),
            max(location.lng - dlng, -180),
            min(location.lat + dlat, 90),
            min(location.lng + dlng, 180),
        )
        response = await client.get(
            WFS_URL,
            params={
                "service": "WFS",
                "version": "1.1.0",
                "request": "GetFeature",
                "typeName": "mrds",
                "bbox": ",".join(f"{v:.5f}" for v in bbox) + ",EPSG:4326",
                "maxFeatures": 400,
            },
        )
        response.raise_for_status()
        try:
            root = ElementTree.fromstring(response.content)
        except ElementTree.ParseError as exc:
            raise ValueError("Occurrence service returned unreadable data") from exc
        features = []
        for node in root.iter(f"{{{MS_NS}}}mrds"):
            pos = node.find(f".//{{{GML_NS}}}pos")
            if pos is None or not pos.text:
                continue
            lat, lng = (float(v) for v in pos.text.split()[:2])
            row = {
                key: (node.findtext(f"{{{MS_NS}}}{key}") or "").strip() or None
                for key in ("dep_id", "site_name", "dev_stat", "code_list", "url")
            }
            if row["dep_id"]:
                features.append((row, lng, lat))
        return features, len(features) >= 400

    def _build(self, features, truncated, location, radius_km):
        evidence, occurrences = [], []
        for row, x, y in features:
            distance = distance_m((location.lng, location.lat), (x, y))
            if distance > radius_km * 1000:
                continue
            codes = re.findall(r"[A-Z]+", (row.get("code_list") or "").upper())
            commodities = sorted({COMMODITY_CODES[c] for c in codes if c in COMMODITY_CODES})
            occurrence = {
                "id": str(row["dep_id"]),
                "name": row.get("site_name") or "Unnamed record",
                "status": row.get("dev_stat") or "Unknown",
                "commodities": commodities,
                "distance_m": round(distance),
                "lat": y,
                "lng": x,
                "source_id": self.source.id,
                "url": f"https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id={row['dep_id']}",
                "raw": row,
            }
            occurrences.append(occurrence)
            for commodity in commodities:
                evidence.append(
                    Evidence(
                        id=f"mrds:{row['dep_id']}:{commodity}",
                        source_id=self.source.id,
                        feature_id=str(row["dep_id"]),
                        evidence_type="regional_occurrence",
                        commodity=commodity,
                        direction="positive",
                        description=f"{commodity} is reported at {occurrence['name']}, {distance / 1000:.1f} km from the selected point. This does not establish mineralization at the point.",
                        distance_m=round(distance),
                        raw_value=row,
                    )
                )
        occurrences.sort(key=lambda item: item["distance_m"])
        return ProviderResult(
            source=self.source,
            status="available" if occurrences else "empty",
            evidence=evidence,
            occurrences=occurrences,
            message="Results limited to 250 records; search a smaller radius for dense districts."
            if truncated
            else "Historical occurrence records; no inference of current mine activity.",
        )


# Country-specific providers plug into this registry, never into UI components.
COUNTRY_PROVIDERS: dict[str, list[GeologyProvider]] = {}


PROVIDER_DEADLINE = 60


async def collect(
    location: Point, radius_km: float, disabled: set[str], on_done=None
) -> list[ProviderResult]:
    providers = [
        MacrostratProvider(),
        USGSOccurrenceProvider(),
        LiteratureProvider(),
        StructureProvider(),
        *COUNTRY_PROVIDERS.get(location.country_code or "", []),
    ]
    async with httpx.AsyncClient(
        timeout=18, headers={"User-Agent": USER_AGENT}, follow_redirects=True
    ) as client:

        async def guarded(provider):
            if not LIVE_PROVIDERS or provider.source.id in disabled:
                return ProviderResult(
                    source=provider.source,
                    status="disabled",
                    message="This provider is disabled. No evidence was retrieved.",
                )
            try:
                # Per-read timeouts can't stop a slow trickle; cap each source overall.
                result = await asyncio.wait_for(
                    provider.fetch(client, location, radius_km), PROVIDER_DEADLINE
                )
            except (TimeoutError, httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                log.warning(
                    "provider_failed source=%s error=%s", provider.source.id, type(exc).__name__
                )
                result = ProviderResult(
                    source=provider.source,
                    status="unavailable",
                    message="This dataset is temporarily unavailable. Try again later; no conclusions have been drawn from the missing data.",
                )
            if on_done:
                on_done(provider.source.id, result.status)
            return result

        return await asyncio.gather(*(guarded(provider) for provider in providers))
