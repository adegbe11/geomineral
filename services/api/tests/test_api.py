import base64
import io
import json

import pytest
from fastapi.testclient import TestClient
from geomineral.db import AnalysisRun, Base, get_db
from geomineral.main import app, requests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def clients():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)

    def override():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override
    requests.clear()
    with TestClient(app) as a, TestClient(app) as b:
        yield a, b, factory
    app.dependency_overrides.clear()
    engine.dispose()


def register(client, email):
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "test-only-long-passphrase"}
    )
    assert response.status_code == 201
    assert "HttpOnly" in response.headers["set-cookie"]
    return response.json()


def photo_fixture():
    from PIL import Image

    output = io.BytesIO()
    Image.new("RGB", (40, 40), "gray").save(output, "PNG")
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode()


def test_sample_photos_persist_privately_and_validate(clients):
    a, b, _ = clients
    register(a, "photos@example.test")
    register(b, "other@example.test")
    point = {"lat": 0, "lng": 0}
    project = a.post("/api/projects", json={"name": "Photos", "location": point}).json()
    path = f"/api/projects/{project['id']}"
    body = {
        "kind": "sample",
        "title": "PHOTO-1",
        "description": "Synthetic fixture",
        "location": point,
        "photos": [photo_fixture()],
    }
    assert a.post(path + "/records", json=body).status_code == 201
    saved = a.get(path).json()["records"][0]["photos"][0]
    assert saved.startswith("data:image/jpeg;base64,")
    assert b.get(path).status_code == 404
    assert b.get(path + "/report").status_code == 404
    body["photos"] = ["data:image/jpeg;base64,bm90IGFuIGltYWdl"]
    assert a.post(path + "/records", json=body).status_code == 422
    body["photos"] = [photo_fixture()] * 4
    assert a.post(path + "/records", json=body).status_code == 422


def test_scan_requires_auth_and_configuration(clients, monkeypatch):
    monkeypatch.setenv("ROCK_VISION_PROVIDER", "openai")
    a, _, _ = clients
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert a.get("/api/scan/status").json() == {"available": False, "provider": "openai"}
    assert a.post("/api/scan", json={"photos": [photo_fixture()]}).status_code == 401
    register(a, "scan@example.test")
    assert a.post("/api/scan", json={"photos": [photo_fixture()]}).status_code == 503


@pytest.mark.asyncio
async def test_vision_contract_and_failure(monkeypatch):
    monkeypatch.setenv("ROCK_VISION_PROVIDER", "openai")
    import httpx
    from fastapi import HTTPException
    from geomineral import vision

    monkeypatch.setenv("OPENAI_API_KEY", "synthetic-test-key")
    monkeypatch.setenv("ROCK_VISION_MODEL", "test-model")

    async def response(self, url, **kwargs):
        payload = kwargs["json"]
        assert payload["store"] is False
        assert payload["input"][0]["content"][0]["image_url"].startswith("data:image/jpeg")
        assert payload["text"]["format"]["strict"] is True
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "status": "completed",
                "output": [
                    {
                        "content": [
                            {
                                "type": "output_text",
                                "text": json.dumps(
                                    {
                                        "candidate": "Unidentified",
                                        "observations": "Synthetic image.",
                                        "next_check": "Use a clear photo.",
                                    }
                                ),
                            }
                        ]
                    }
                ],
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", response)
    body = vision.ScanInput(photos=[photo_fixture()])
    assert (await vision.identify(body))["candidate"] == "Unidentified"

    async def failure(*args, **kwargs):
        raise httpx.ConnectError("unavailable")

    monkeypatch.setattr(httpx.AsyncClient, "post", failure)
    with pytest.raises(HTTPException) as error:
        await vision.identify(body)
    assert error.value.status_code == 503


def test_projects_private_and_sample_workflow(clients):
    a, b, _ = clients
    register(a, "a@example.test")
    register(b, "b@example.test")
    point = {"lat": 7, "lng": 6, "name": "Test location"}
    project = a.post("/api/projects", json={"name": "Test project", "location": point}).json()
    assert b.get(f"/api/projects/{project['id']}").status_code == 404
    assert b.get(f"/api/projects/{project['id']}/report").status_code == 404
    assert b.get("/api/projects").json() == []
    record = {
        "kind": "sample",
        "title": "GM-001",
        "description": "Synthetic sample for test only",
        "location": point,
    }
    assert a.post(f"/api/projects/{project['id']}/records", json=record).status_code == 201
    assert a.post(f"/api/projects/{project['id']}/records", json=record).status_code == 409
    assert b.post(f"/api/projects/{project['id']}/records", json=record).status_code == 404
    assert len(a.get(f"/api/projects/{project['id']}/report").json()["project"]["records"]) == 1


def test_guests_cannot_read_other_analysis_or_save_projects(clients):
    a, b, _ = clients
    run = a.post("/api/analyses", json={"location": {"lat": 0, "lng": 0}}).json()
    assert a.get(f"/api/analyses/{run['id']}").status_code == 200
    assert b.get(f"/api/analyses/{run['id']}").status_code == 404
    assert a.get("/api/projects").status_code == 401


def test_invalid_geometry_and_csrf(clients):
    a, _, _ = clients
    register(a, "a@example.test")
    body = {
        "name": "Invalid",
        "location": {"lat": 0, "lng": 0},
        "polygon": [[0, 0], [1, 1], [0, 1], [1, 0]],
    }
    assert a.post("/api/projects", json=body).status_code == 422
    assert (
        a.post("/api/projects", json=body, headers={"Origin": "https://evil.example"}).status_code
        == 403
    )


def test_admin_routes_deny_regular_users_and_logout_revokes(clients):
    a, _, _ = clients
    register(a, "a@example.test")
    assert a.patch("/api/admin/datasets/macrostrat", json={"enabled": False}).status_code == 403
    cookie = a.cookies.get("gm_session")
    a.post("/api/auth/logout")
    a.cookies.set("gm_session", cookie)
    assert a.get("/api/projects").status_code == 401


def test_cannot_attach_other_accounts_analysis(clients):
    a, b, _ = clients
    register(a, "a@example.test")
    register(b, "b@example.test")
    run = a.post("/api/analyses", json={"location": {"lat": 0, "lng": 0}}).json()
    response = b.post(
        "/api/projects",
        json={"name": "Wrong owner", "location": {"lat": 0, "lng": 0}, "analysis_id": run["id"]},
    )
    assert response.status_code == 404


def test_coordinate_search_and_validation(clients):
    a, _, _ = clients
    assert a.get("/api/search", params={"q": "6.9, 6.1"}).json()[0]["lat"] == 6.9
    assert a.get("/api/search", params={"q": "100, 0"}).status_code == 422
    assert a.post("/api/analyses", json={"location": {"lat": 100, "lng": 0}}).status_code == 422


def test_analysis_cannot_be_relabelled_as_another_location(clients):
    a, _, _ = clients
    register(a, "owner@example.test")
    run = a.post("/api/analyses", json={"location": {"lat": 0, "lng": 0}}).json()
    response = a.post(
        "/api/projects",
        json={"name": "Mismatch", "location": {"lat": 10, "lng": 0}, "analysis_id": run["id"]},
    )
    assert response.status_code == 422


async def test_worker_completes_and_keeps_snapshot(clients, monkeypatch):
    from geomineral import worker
    from geomineral.providers import MACROSTRAT
    from geomineral.schemas import ProviderResult

    a, _, factory = clients
    monkeypatch.setattr(worker, "SessionLocal", factory)

    async def fixture_collect(*args):
        return [
            ProviderResult(
                source=MACROSTRAT, status="empty", message="Synthetic empty test response"
            )
        ]

    monkeypatch.setattr(worker, "collect", fixture_collect)
    run = a.post("/api/analyses", json={"location": {"lat": 0, "lng": 0}}).json()
    assert await worker.process_one()
    with factory() as db:
        saved = db.get(AnalysisRun, run["id"])
        assert saved.status == "complete"
        assert json.loads(saved.result_json)["providers"][0]["status"] == "empty"
    assert not await worker.process_one()


def test_mobile_bearer_sessions_and_revocation(clients):
    a, b, _ = clients
    result = a.post(
        "/api/mobile/auth/register",
        json={"email": "native@example.test", "password": "test-only-long-passphrase"},
    )
    assert result.status_code == 201
    assert "set-cookie" not in result.headers
    token = result.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert b.get("/api/auth/me", headers=headers).json()["email"] == "native@example.test"
    assert b.get("/api/projects", headers=headers).status_code == 200
    assert b.get("/api/projects").status_code == 401
    assert b.post("/api/auth/logout", headers=headers).status_code == 200
    assert b.get("/api/projects", headers=headers).status_code == 401


def test_mobile_guest_header_isolation(clients):
    a, b, _ = clients
    token = a.post("/api/mobile/guest").json()["token"]
    headers = {"X-Guest-Token": token}
    run = a.post("/api/analyses", headers=headers, json={"location": {"lat": 0, "lng": 0}}).json()
    a.cookies.clear()
    assert a.get(f"/api/analyses/{run['id']}", headers=headers).status_code == 200
    assert b.get(f"/api/analyses/{run['id']}").status_code == 404
