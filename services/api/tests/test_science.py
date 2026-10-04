import httpx
import pytest
from geomineral.analysis import assess, build_analysis
from geomineral.geo import distance_m, polygon_area_m2
from geomineral.providers import MACROSTRAT, MacrostratProvider, USGSOccurrenceProvider
from geomineral.schemas import AnalysisRequest, Evidence, Point, ProviderResult


def test_no_evidence_means_no_candidates():
    assert assess([]) == []


def test_one_distant_record_is_only_low():
    evidence = Evidence(
        id="test",
        source_id="fixture",
        feature_id="1",
        evidence_type="regional_occurrence",
        description="Synthetic test record",
        commodity="Gold",
        direction="positive",
    )
    result = assess([evidence])[0]
    assert result.prospectivity == "Low"
    assert result.site_count == 1


def test_specific_host_and_contradiction_are_distinct():
    host = Evidence(
        id="host",
        source_id="fixture",
        feature_id="1",
        evidence_type="mapped_geology",
        description="Synthetic limestone",
        raw_value={"lith": "limestone"},
    )
    assert assess([host])[0].prospectivity == "Moderate"
    negative = Evidence(
        id="barren",
        source_id="fixture",
        feature_id="2",
        evidence_type="assay",
        commodity="Limestone",
        direction="negative",
        description="Synthetic contradiction",
    )
    assert assess([host, negative])[0].prospectivity == "Insufficient evidence"


def _site(dep, commodity, km, stat="Occurrence"):
    return Evidence(
        id=f"mrds:{dep}:{commodity}",
        source_id="usgs-mrds",
        feature_id=dep,
        evidence_type="regional_occurrence",
        commodity=commodity,
        direction="positive",
        description="Synthetic site",
        distance_m=km * 1000,
        raw_value={"dev_stat": stat},
    )


def test_greenstone_with_gold_mines_is_high_and_ranked_first():
    rock = Evidence(
        id="rock",
        source_id="macrostrat",
        feature_id="1",
        evidence_type="mapped_geology",
        description="Synthetic greenstone",
        raw_value={"lith": "greenstone belt; mafic-ultramafic volcanic rocks"},
    )
    sites = [_site(str(i), "Gold", 3 + i, "Past Producer") for i in range(4)]
    result = assess([rock, *sites, _site("x", "Silver", 20)])
    assert result[0].commodity == "Gold"
    assert result[0].prospectivity == "High"
    assert result[0].site_count == 4
    assert result[0].nearest_km == 3.0
    assert result[0].host_rocks == ["greenstone"]
    nickel = next(a for a in result if a.commodity == "Nickel")
    assert nickel.prospectivity == "Low"


def test_same_site_counted_once():
    result = assess([_site("1", "Gold", 2), _site("1", "Gold", 2)])[0]
    assert result.site_count == 1
    assert result.prospectivity == "Moderate"


def test_summary_names_best_signal_and_site_count():
    from geomineral.providers import MRDS

    result = build_analysis(
        AnalysisRequest(location=Point(lat=0, lng=0)),
        [
            ProviderResult(
                source=MRDS,
                status="available",
                evidence=[_site("1", "Gold", 2)],
                occurrences=[{"id": "1", "distance_m": 2000}],
            )
        ],
    )
    assert result["rating"] == "Moderate"
    assert "Best signal: Gold (Moderate)" in result["summary"]
    assert "1 recorded mineral sites within 25 km" in result["summary"]


def test_generic_sedimentary_rock_suggests_nothing_on_its_own():
    host = Evidence(
        id="host",
        source_id="fixture",
        feature_id="1",
        evidence_type="mapped_geology",
        description="Synthetic generic sediment",
        raw_value={"lith": "sedimentary"},
    )
    assert assess([host]) == []


def _model(mineral: str, top_pct: float) -> Evidence:
    return Evidence(
        id=f"model:{mineral}",
        source_id="ground-model",
        feature_id=mineral,
        evidence_type="ground_model",
        commodity=mineral,
        description="Synthetic model score",
        raw_value={
            "mineral": mineral,
            "top_pct": top_pct,
            "probability": 0.5,
            "deposit_pct": 60,
            "auc": 0.82,
            "layers": {"Geology": 0.2, "Magnetics": 0.05, "Terrain": 0.01},
        },
    )


def test_ground_model_proposes_minerals_only_when_ground_ranks_high():
    found = {
        a.commodity: a
        for a in assess([_model("Gold", 1.5), _model("Tin", 8), _model("Lithium", 40)])
    }
    assert set(found) == {"Gold", "Tin"}
    assert found["Gold"].prospectivity == "Moderate" and found["Tin"].prospectivity == "Low"
    assert "top 1.5% of land for gold, judged by its geology" in found["Gold"].explanation
    row = next(b for b in found["Gold"].breakdown if b["layer"] == "Ground model")
    assert row["strength"] == 98


def test_unavailable_is_not_empty_and_no_percentage_claims():
    result = build_analysis(
        AnalysisRequest(location=Point(lat=0, lng=0)),
        [ProviderResult(source=MACROSTRAT, status="unavailable")],
    )
    assert result["coverage"][0]["status"] == "unavailable"
    assert result["evidence_quality"] == "Very Limited"
    assert "insufficient evidence" in result["summary"]
    assert result["assessments"] == []
    assert result["model_version"]
    assert len(result["evidence_fingerprint"]) == 64


def test_geodesic_distance_and_dateline():
    assert 111000 < distance_m((0, 0), (1, 0)) < 112000
    assert 22000 < distance_m((179.9, 0), (-179.9, 0)) < 23000


def test_polygon_area_and_invalid_geometry():
    assert 12e9 < polygon_area_m2([[0, 0], [1, 0], [1, 1], [0, 1]]) < 13e9
    with pytest.raises(ValueError):
        polygon_area_m2([[0, 0], [1, 1], [0, 1], [1, 0]])
    with pytest.raises(ValueError):
        polygon_area_m2([[0, 0], [0, 0], [0, 0]])


@pytest.mark.parametrize("lat,lng", [(91, 0), (0, -181), (float("nan"), 0), (0, float("inf"))])
def test_reject_invalid_coordinates(lat, lng):
    with pytest.raises(ValueError):
        Point(lat=lat, lng=lng)


async def test_macrostrat_normalizes_original_reference():
    payload = {
        "success": {
            "data": [
                {"map_id": 123, "source_id": 4, "name": "Fixture limestone", "lith": "limestone"}
            ],
            "refs": {"4": "Synthetic citation for test only"},
        }
    }
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, json=payload))
    ) as client:
        result = await MacrostratProvider().fetch(client, Point(lat=0, lng=0), 25)
    assert result.evidence[0].raw_value["publication"] == "Synthetic citation for test only"
    assert result.evidence[0].observed_or_inferred == "reported"


async def test_occurrences_filter_distance_and_map_codes():
    payload = {
        "features": [
            {
                "attributes": {
                    "dep_id": "fixture1",
                    "site_name": "Fixture mine",
                    "code_list": " AU CU ",
                    "dev_stat": "Past Producer",
                },
                "geometry": {"x": 0.01, "y": 0},
            },
            {
                "attributes": {"dep_id": "fixture2", "code_list": " LI "},
                "geometry": {"x": 10, "y": 0},
            },
        ]
    }
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, json=payload))
    ) as client:
        result = await USGSOccurrenceProvider().fetch(client, Point(lat=0, lng=0), 25)
    assert len(result.occurrences) == 1
    assert result.occurrences[0]["commodities"] == ["Copper", "Gold"]
    assert result.occurrences[0]["status"] == "Past Producer"


async def test_upstream_error_does_not_become_absence():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda r: httpx.Response(200, json={"error": {"message": "down"}})
        )
    ) as client:
        with pytest.raises(ValueError):
            await USGSOccurrenceProvider().fetch(client, Point(lat=0, lng=0), 25)


async def test_occurrences_fall_back_to_wfs_when_arcgis_is_down():
    gml = b"""<wfs:FeatureCollection xmlns:ms="http://mapserver.gis.umn.edu/mapserver"
      xmlns:gml="http://www.opengis.net/gml" xmlns:wfs="http://www.opengis.net/wfs">
      <gml:featureMember><ms:mrds><ms:geometry><gml:Point><gml:pos>0.0 0.01</gml:pos></gml:Point></ms:geometry>
      <ms:dep_id>w1</ms:dep_id><ms:site_name>Fixture WFS mine</ms:site_name>
      <ms:dev_stat>Producer</ms:dev_stat><ms:code_list> AU </ms:code_list></ms:mrds></gml:featureMember>
    </wfs:FeatureCollection>"""

    def handler(request):
        if "arcgis" in str(request.url):
            return httpx.Response(503, text="The service is unavailable.")
        return httpx.Response(200, content=gml)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await USGSOccurrenceProvider().fetch(client, Point(lat=0, lng=0), 25)
    assert result.status == "available"
    assert result.occurrences[0]["name"] == "Fixture WFS mine"
    assert result.occurrences[0]["commodities"] == ["Gold"]
    assert 1000 < result.occurrences[0]["distance_m"] < 1200


async def test_unconfigured_rock_provider_never_returns_a_guess():
    from geomineral.rock import UnavailableRockProvider

    result = await UnavailableRockProvider().identify(["test-only/photo1", "test-only/photo2"])
    assert result.status == "unavailable"
    assert result.candidates == []


async def test_provider_failure_is_isolated(monkeypatch):
    from geomineral import providers

    async def fails(*args):
        raise httpx.ConnectError("Synthetic outage")

    async def empty(*args):
        return ProviderResult(source=providers.MRDS, status="empty")

    monkeypatch.setattr(providers.MacrostratProvider, "fetch", fails)
    monkeypatch.setattr(providers.USGSOccurrenceProvider, "fetch", empty)
    for cls in (
        providers.WikidataMinesProvider,
        providers.LiteratureProvider,
        providers.StructureProvider,
        providers.MagneticsProvider,
        providers.TerrainProvider,
        providers.SatelliteProvider,
        providers.GroundModelProvider,
    ):
        monkeypatch.setattr(cls, "fetch", empty)
    monkeypatch.setattr(providers, "LIVE_PROVIDERS", True)
    results = await providers.collect(Point(lat=0, lng=0), 25, set())
    assert [r.status for r in results] == ["unavailable"] + ["empty"] * 8


async def test_deep_time_marks_unplaced_points_and_caches(monkeypatch):
    from geomineral import deeptime

    deeptime._points.clear()
    calls = []

    def handler(request):
        calls.append(request.url.params["time"])
        age = float(request.url.params["time"])
        coords = [[999.99, 999.99]] if age > 250 else [[10.0 + age / 100, -5.0]]
        return httpx.Response(200, json={"type": "MultiPoint", "coordinates": coords})

    real = httpx.AsyncClient
    monkeypatch.setattr(
        deeptime.httpx,
        "AsyncClient",
        lambda **kw: real(transport=httpx.MockTransport(handler), **kw),
    )
    first = await deeptime.positions(1.0, 2.0)
    assert first[0] == {"age": 0, "lat": 1.0, "lng": 2.0}
    assert first[deeptime.AGES.index(200)] == {"age": 200, "lat": -5.0, "lng": 12.0}
    assert first[deeptime.AGES.index(500)] is None
    count = len(calls)
    assert await deeptime.positions(1.0, 2.0) == first
    assert len(calls) == count


async def test_land_status_picks_most_restrictive_and_handles_gaps(monkeypatch):
    from geomineral import land

    responses = {
        "park": [
            {
                "Mang_Name": "NPS",
                "Des_Tp": "NP",
                "Unit_Nm": "Yosemite National Park",
                "GAP_Sts": "1",
                "FeatClass": "Fee",
            },
            {
                "Mang_Name": "USFS",
                "Des_Tp": "NF",
                "Unit_Nm": "Nearby forest",
                "GAP_Sts": "3",
                "FeatClass": "Fee",
            },
        ],
        "blm": [
            {
                "Mang_Name": "BLM",
                "Des_Tp": "PUB",
                "Unit_Nm": "BLM land",
                "GAP_Sts": "3",
                "FeatClass": "Fee",
            }
        ],
        "none": [],
    }
    current = {"key": "park"}
    real = httpx.AsyncClient

    def handler(request):
        rows = responses[current["key"]]
        return httpx.Response(200, json={"features": [{"attributes": a} for a in rows]})

    monkeypatch.setattr(
        land.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw)
    )
    park = await land.lookup(37.74, -119.58)
    assert park["status"] == "No collecting"
    assert park["unit"] == "Yosemite National Park"
    current["key"] = "blm"
    blm = await land.lookup(36.5, -116.0)
    assert blm["status"] == "Limited collecting" and blm["manager"] == "Bureau of Land Management"
    current["key"] = "none"
    assert (await land.lookup(40.0, -100.0))["status"] == "No public land record"
    outside = await land.lookup(6.98, 6.12)
    assert outside["covered"] is False


def _work(wid, title, abstract="", year=2023):
    words = abstract.split()
    return {
        "id": f"https://openalex.org/{wid}",
        "display_name": title,
        "publication_year": year,
        "doi": f"https://doi.org/10.0/{wid}",
        "abstract_inverted_index": {w: [i] for i, w in enumerate(words)},
    }


async def test_literature_finds_studied_minerals_and_skips_farming_papers(monkeypatch):
    from geomineral import analysis, literature

    literature._cache.clear()
    monkeypatch.delenv("OPENALEX_API_KEY", raising=False)
    works = [
        _work("W1", "Assessment of the refractory properties of clay mineral deposits in Uhonmora"),
        _work(
            "W2",
            "Kaolin and clay deposits of the Owan basin",
            "Clay samples from Uhonmora were studied",
        ),
        _work(
            "W3",
            "Micronutrient assessment of cocoa plantations at Uhonmora",
            "copper zinc iron in soils",
        ),
        _work("W4", "Gold mineralization in Ilesha schist belt", "no mention of the town"),
    ]

    def handler(request):
        if request.url.host == "nominatim.openstreetmap.org":
            return httpx.Response(200, json={"address": {}})
        assert request.url.params["search"] == '"Uhonmora"'
        return httpx.Response(200, json={"results": works})

    real = httpx.AsyncClient
    async with real(transport=httpx.MockTransport(handler)) as client:
        result = await literature.LiteratureProvider().fetch(
            client, Point(lat=6.98, lng=6.12, name="Uhonmora, Edo State, Nigeria"), 25
        )
    found = {(e.commodity, e.feature_id.rsplit("/", 1)[-1]) for e in result.evidence}
    assert ("Clay", "W1") in found and ("Clay", "W2") in found and ("Kaolin", "W2") in found
    assert not any(c in ("Copper", "Zinc", "Iron", "Gold") for c, _ in found)
    clay = next(a for a in analysis.assess(result.evidence) if a.commodity == "Clay")
    assert clay.prospectivity == "Moderate"
    assert clay.papers[0]["studied"] is True
    assert "Studied at Uhonmora in 2 published papers" in clay.explanation


async def test_full_text_mentions_need_a_key_and_only_reach_low(monkeypatch):
    from geomineral import analysis, literature

    literature._cache.clear()
    monkeypatch.setenv("OPENALEX_API_KEY", "test-only-key")
    road = _work(
        "W9", "Troubled roads: surface geophysics of the sedimentary terrain", "Uhonmora shale"
    )

    def handler(request):
        if request.url.host == "nominatim.openstreetmap.org":
            return httpx.Response(200, json={"address": {}})
        assert request.url.params["api_key"] == "test-only-key"
        q = request.url.params["search"]
        return httpx.Response(200, json={"results": [road] if q == '"Uhonmora" gypsum' else []})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await literature.LiteratureProvider().fetch(
            client, Point(lat=6.98, lng=6.12, name="Uhonmora"), 25
        )
    gypsum = [a for a in analysis.assess(result.evidence) if a.commodity == "Gypsum"][0]
    assert gypsum.prospectivity == "Low"
    assert gypsum.papers[0]["studied"] is False
    assert "Mentioned in 1 paper about Uhonmora" in gypsum.explanation


async def test_research_falls_back_to_crossref_when_openalex_is_limited(monkeypatch):
    from geomineral import literature

    literature._cache.clear()
    monkeypatch.delenv("OPENALEX_API_KEY", raising=False)

    def handler(request):
        if request.url.host == "nominatim.openstreetmap.org":
            return httpx.Response(200, json={"address": {"village": "Uhonmora"}})
        if request.url.host == "api.openalex.org":
            return httpx.Response(429, json={"error": "limit"})
        item = {
            "DOI": "10.0/clay",
            "title": ["Refractory properties of clay deposits in Uhonmora"],
            "issued": {"date-parts": [[2015]]},
        }
        return httpx.Response(200, json={"message": {"items": [item]}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await literature.LiteratureProvider().fetch(
            client, Point(lat=7.1, lng=6.2, name="Owan West, Edo, Nigeria"), 25
        )
    assert result.status == "available"
    assert [e.commodity for e in result.evidence] == ["Clay"]
    assert result.layers["place"] == ["Uhonmora"]
    # A backup-only answer is cached for hours, not the full week.
    stamp, _ = literature._cache["uhonmora"]
    assert stamp < literature.time.time() - literature.CACHE_SECONDS + 7 * 3600


async def test_research_outage_is_reported_not_treated_as_absence(monkeypatch):
    from geomineral import literature

    literature._cache.clear()
    monkeypatch.delenv("OPENALEX_API_KEY", raising=False)

    def handler(request):
        if request.url.host == "nominatim.openstreetmap.org":
            return httpx.Response(200, json={"address": {}})
        return httpx.Response(503)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await literature.LiteratureProvider().fetch(
            client, Point(lat=1, lng=2, name="Kumasi"), 25
        )
    assert result.status == "unavailable"
    assert result.evidence == []


async def test_mines_inside_radius_are_sites_and_regional_mines_only_possible():
    from geomineral import mines
    from geomineral.analysis import assess

    mines._cache.clear()

    def row(qid, lat, lng, products):
        return {
            "m": {"value": f"http://www.wikidata.org/entity/{qid}"},
            "mLabel": {"value": f"{qid} mine"},
            "loc": {"value": f"Point({lng} {lat})"},
            "products": {"value": products},
        }

    def handler(request):
        rows = [row("Q1", 7.2, 6.2, "gold ore"), row("Q2", 7.6, 6.2, "iron ore|limestone")]
        return httpx.Response(200, json={"results": {"bindings": rows}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await mines.WikidataMinesProvider().fetch(client, Point(lat=7.17, lng=6.21), 25)
    assert [o["id"] for o in result.occurrences] == ["Q1"]
    found = {a.commodity: a for a in assess(result.evidence)}
    assert found["Gold"].site_count == 1
    assert found["Iron"].prospectivity == "Low"
    assert found["Iron"].site_count == 0
    assert "Mined in the region: Q2 mine" in found["Iron"].explanation


def test_nearby_fault_strengthens_but_never_creates_a_candidate():
    from geomineral.analysis import assess

    fault = Evidence(
        id="structure:fault:1",
        source_id="macrostrat-structure",
        feature_id="1",
        evidence_type="structure",
        description="Synthetic fault",
        distance_m=2000,
        raw_value={"nearest_km": 2.0, "count": 3, "total_km": 12.0},
    )
    assert assess([fault]) == []
    gold_site = Evidence(
        id="mrds:1:Gold",
        source_id="usgs-mrds",
        feature_id="1",
        evidence_type="regional_occurrence",
        commodity="Gold",
        direction="positive",
        description="Synthetic site",
        distance_m=12000,
        raw_value={"dev_stat": "Occurrence"},
    )
    alone = assess([gold_site])[0]
    with_fault = assess([gold_site, fault])[0]
    assert alone.prospectivity == "Low"
    assert with_fault.prospectivity == "Moderate"
    assert "mapped fault 2.0 km away" in with_fault.explanation


async def test_structure_reads_fault_distance_from_tiles(monkeypatch):
    import mapbox_vector_tile
    from geomineral import structure

    # A fault line just east of the pin at (0, 0), encoded like Macrostrat tiles.
    tile = mapbox_vector_tile.encode(
        [
            {
                "name": "lines",
                "features": [
                    {
                        "geometry": "LINESTRING(10 0, 10 4096)",
                        "properties": {"line_id": 7, "type": "fault"},
                    }
                ],
            }
        ]
    )
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, content=tile))
    ) as client:
        result = await structure.StructureProvider().fetch(client, Point(lat=0.0, lng=0.0), 25)
    assert result.status == "available"
    assert result.evidence[0].raw_value["count"] == 1
    assert result.layers["faults"][0]["paths"]


def test_zones_find_a_target_at_the_cluster_and_name_it():
    from geomineral.zones import build_zones

    # Three producing gold sites ~8 km east of the pin, on mapped greenstone, beside a fault.
    sites = [
        {"lat": 0.0 + d, "lng": 0.072 + d, "status": "Producer", "commodities": ["Gold"]}
        for d in (0.0, 0.005, -0.005)
    ]
    layers = {
        "units": [
            {
                "name": "Greenstone belt",
                "lith": "greenstone",
                "rings": [
                    [[0.04, -0.04], [0.11, -0.04], [0.11, 0.04], [0.04, 0.04], [0.04, -0.04]]
                ],
            }
        ],
        "faults": [{"type": "fault", "paths": [[[0.08, -0.2], [0.08, 0.2]]]}],
    }
    zones = build_zones(0.0, 0.0, 25, "Testville", ["Gold"], layers, sites)
    target = zones["by_commodity"]["Gold"]["targets"][0]
    assert target["id"] == "GM-TES-01"
    assert 6 < target["distance_km"] < 11
    assert target["score"] == zones["by_commodity"]["Gold"]["max"]
    assert any("greenstone" in r.lower() for r in target["reasons"])
    assert any("fault" in r for r in target["reasons"])


def test_no_zones_without_positioned_evidence():
    from geomineral.analysis import build_analysis
    from geomineral.literature import OPENALEX

    paper = Evidence(
        id="openalex:W1:Clay",
        source_id="openalex",
        feature_id="W1",
        evidence_type="literature",
        commodity="Clay",
        direction="positive",
        description="Synthetic study",
        raw_value={
            "title": "Clay deposits",
            "year": 2023,
            "url": "https://doi.org/x",
            "place": "X",
            "studied": True,
        },
    )
    result = build_analysis(
        AnalysisRequest(location=Point(lat=0, lng=0, name="X")),
        [ProviderResult(source=OPENALEX, status="available", evidence=[paper])],
    )
    assert result["assessments"][0]["commodity"] == "Clay"
    assert result["zones"]["by_commodity"] == {}


def _layer(kind: str, raw: dict) -> Evidence:
    return Evidence(
        id=f"{kind}:1",
        source_id="fixture",
        feature_id="1",
        evidence_type=kind,
        description="Synthetic layer",
        raw_value=raw,
    )


def _gold_site(commodity: str) -> Evidence:
    return Evidence(
        id=f"mrds:9:{commodity}",
        source_id="usgs-mrds",
        feature_id="9",
        evidence_type="regional_occurrence",
        commodity=commodity,
        direction="positive",
        description="Synthetic site",
        distance_m=8000,
    )


MAG = {
    "level": "quiet",
    "pin_nt": 0,
    "high_nt": 20,
    "high_km": 3,
    "high_dir": "north",
    "contrast_nt": 30,
    "grad_max": 2,
}
SAT = {
    "readable": True,
    "bare_pct": 40,
    "iron_km2": 5,
    "clay_km2": 0,
    "iron_share": 0.08,
    "clay_share": 0.01,
    "iron_notable": True,
    "clay_notable": False,
}


def test_magnetic_grid_levels():
    import numpy as np
    from geomineral.geophysics import describe

    flat = describe(np.zeros((32, 32)), 25)
    assert flat["level"] == "quiet" and flat["grad_max"] == 0
    spike = np.zeros((32, 32))
    spike[10, 20] = 900
    hot = describe(spike, 25)
    assert hot["level"] == "strong" and hot["high_nt"] == 900
    assert hot["high_dir"] in ("north-east", "north")


def test_strong_magnetic_high_alone_suggests_iron_only():
    found = {
        a.commodity: a
        for a in assess([_layer("magnetics", {**MAG, "high_nt": 900, "level": "strong"})])
    }
    assert set(found) == {"Iron"}
    assert found["Iron"].prospectivity == "Low"
    assert "magnetic high of 900 nT" in found["Iron"].explanation
    mags = [b for b in found["Iron"].breakdown if b["layer"] == "Magnetics"]
    assert mags[0]["strength"] == 90


def test_magnetics_and_alteration_strengthen_but_never_create():
    assert assess([_layer("magnetics", {**MAG, "level": "contacts", "grad_max": 12})]) == []
    assert assess([_layer("alteration", SAT)]) == []
    alone = assess([_gold_site("Gold")])[0]
    both = assess(
        [
            _gold_site("Gold"),
            _layer("magnetics", {**MAG, "level": "contacts", "grad_max": 12}),
            _layer("alteration", SAT),
        ]
    )[0]
    assert alone.score == 1 and both.score == 3
    assert "Magnetic contacts here (up to 12 nT/km)" in both.explanation
    assert "Satellite: iron-oxide staining over 5 km² of bare ground." in both.explanation


def test_breakdown_tells_no_data_from_nothing_found():
    gold = assess([_gold_site("Gold")], checked={"usgs-mrds", "openalex"})[0]
    rows = {b["layer"]: b for b in gold.breakdown}
    assert rows["Known sites"]["strength"] > 0
    assert rows["Research"]["strength"] == 0
    assert rows["Geology"]["strength"] is None
    assert rows["Magnetics"]["strength"] is None
    assert rows["Satellite"]["strength"] is None


def test_satellite_ratios_flag_altered_bare_ground():
    import numpy as np
    from geomineral import satellite

    n = satellite.SIZE
    rng = np.random.default_rng(1)
    b = {
        "blue": np.full((n, n), 1000.0),
        "red": 1700 + rng.normal(0, 40, (n, n)),
        "nir": np.full((n, n), 2000.0),
        "swir16": np.full((n, n), 2400.0),
        "swir22": np.full((n, n), 2000.0),
        "scl": np.full((n, n), 5.0),
    }
    b["red"][140:160, 140:160] = 3000  # an iron-stained patch at the pin
    out = satellite.analyse(b, 7.0, 6.0, 25)
    assert out["readable"] and out["bare_pct"] > 90
    assert out["iron_km2"] > 1
    assert any(c["kind"] == "iron" and c["frac"] > 0.5 for c in out["cells"])
    green = dict(b, nir=np.full((n, n), 6000.0))
    assert satellite.analyse(green, 7.0, 6.0, 25)["readable"] is False


def test_terrain_finds_valley_floors():
    import numpy as np
    from geomineral.terrain import describe

    x = np.linspace(-1, 1, 100)
    valley = np.abs(np.add.outer(np.zeros(100), x)) * 400 + 100  # V-shaped valley
    valley[:, 45:55] = 100  # flat floor
    stats = describe(valley, np.ones_like(valley, dtype=bool), 100.0, 100.0)
    assert stats["relief_m"] == 400
    assert stats["valley_pct"] >= 5
