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


def test_generic_sedimentary_rock_does_not_become_limestone():
    host = Evidence(
        id="host",
        source_id="fixture",
        feature_id="1",
        evidence_type="mapped_geology",
        description="Synthetic generic sediment",
        raw_value={"lith": "sedimentary"},
    )
    assert assess([host]) == []


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
    monkeypatch.setattr(providers, "LIVE_PROVIDERS", True)
    results = await providers.collect(Point(lat=0, lng=0), 25, set())
    assert [r.status for r in results] == ["unavailable", "empty"]


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
