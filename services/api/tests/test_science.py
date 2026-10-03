import httpx
import pytest
from geomineral.analysis import assess, build_analysis
from geomineral.geo import distance_m, polygon_area_m2
from geomineral.providers import MACROSTRAT, MacrostratProvider, USGSOccurrenceProvider
from geomineral.schemas import AnalysisRequest, Evidence, Point, ProviderResult


def test_no_evidence_means_no_candidates():
    assert assess([]) == []


def test_regional_gold_does_not_imply_local_prospectivity():
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
    assert result.prospectivity == "Insufficient evidence"
    assert result.evidence_quality == "Very Limited"


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
