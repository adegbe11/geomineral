import json

import httpx
import pytest
from fastapi import HTTPException
from geomineral import vision


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "geological,names,expected",
    [
        (True, ["tourmaline", "Tourmaline", "schorl"], ["Tourmaline", "Schorl"]),
        (False, ["blue", "blue"], []),
        # A small model may flag an obvious specimen as non-geological; known names win.
        (False, ["pyrite", "copper"], ["Pyrite", "Copper"]),
        (True, ["rock", "unknown"], []),
    ],
)
@pytest.mark.parametrize("field", ["content", "thinking"])
async def test_structured_local_candidates_and_non_geological_gate(
    monkeypatch, geological, names, expected, field
):
    monkeypatch.setenv("OLLAMA_VISION_MODEL", "qwen3-vl:2b")
    monkeypatch.setenv("ROCK_VISION_PROVIDER", "ollama")
    monkeypatch.setenv("OPENAI_API_KEY", "must-not-use")

    async def respond(self, url, **kwargs):
        assert url == "http://127.0.0.1:11434/api/chat"
        body = kwargs["json"]
        assert body["format"]["properties"]["is_geological"]["type"] == "boolean"
        assert body["messages"][-1]["images"] == ["test-image"]
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "done": True,
                "done_reason": "stop",
                "message": {
                    field: json.dumps(
                        {
                            "candidates": names,
                            "observations": "Dark elongated crystals.",
                            "is_geological": geological,
                        }
                    )
                },
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", respond)
    result = await vision.identify(
        vision.ScanInput.model_construct(photos=["data:image/jpeg;base64,test-image"])
    )
    assert result["candidates"] == expected
    assert result["candidate"] == (expected[0] if expected else "Unidentified")
    assert "is_geological" not in result


@pytest.mark.asyncio
@pytest.mark.parametrize("content,reason", [("not json", "stop"), ("{}", "stop"), ("{}", "length")])
async def test_structured_local_rejects_invalid_or_truncated_output(monkeypatch, content, reason):
    monkeypatch.setenv("OLLAMA_VISION_MODEL", "qwen3-vl:2b")
    monkeypatch.setenv("ROCK_VISION_PROVIDER", "ollama")

    async def respond(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "done": True,
                "done_reason": reason,
                "message": {"content": content},
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", respond)
    with pytest.raises(HTTPException) as error:
        await vision.identify(
            vision.ScanInput.model_construct(photos=["data:image/jpeg;base64,test-image"])
        )
    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_local_scan_never_uses_paid_api(monkeypatch):
    monkeypatch.delenv("ROCK_VISION_PROVIDER", raising=False)
    monkeypatch.setenv("OLLAMA_VISION_MODEL", "moondream:1.8b")
    monkeypatch.setenv("OPENAI_API_KEY", "must-not-use")

    async def respond(self, url, **kwargs):
        assert url == "http://127.0.0.1:11434/api/chat"
        assert "headers" not in kwargs
        body = kwargs["json"]
        assert body["messages"][0]["images"] == ["test-image"]
        assert body["stream"] is False
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "done": True,
                "done_reason": "stop",
                "message": {"content": "The image shows a blue square on a white background."},
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", respond)
    body = vision.ScanInput.model_construct(photos=["data:image/jpeg;base64,test-image"])
    assert (await vision.identify(body))["candidate"] == "Unidentified"


def test_description_only_extracts_suggested_names():
    assert (
        vision.local_description_result("The rock appears to be granite with a speckled texture.")[
            "candidate"
        ]
        == "Granite"
    )
    assert (
        vision.local_description_result("This rock is not granite.")["candidate"] == "Unidentified"
    )
    assert vision.local_description_result("A blue square on white.")["candidate"] == "Unidentified"


@pytest.mark.asyncio
async def test_local_geological_followup(monkeypatch):
    monkeypatch.setenv("OLLAMA_VISION_MODEL", "moondream:1.8b")
    monkeypatch.setenv("ROCK_VISION_PROVIDER", "ollama")
    prompts = []

    async def respond(self, url, **kwargs):
        assert url.startswith("http://127.0.0.1:11434/")
        prompts.append(kwargs["json"]["messages"][0]["content"])
        description = (
            "A rough gray rock." if len(prompts) == 1 else "This rock appears to be granite."
        )
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={"done": True, "message": {"content": description}},
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", respond)
    result = await vision.identify(
        vision.ScanInput.model_construct(photos=["data:image/jpeg;base64,test-image"])
    )
    assert result["candidate"] == "Granite"
    assert len(prompts) == 2


@pytest.mark.asyncio
async def test_local_status_requires_installed_vision_model(monkeypatch):
    monkeypatch.setenv("ROCK_VISION_PROVIDER", "ollama")

    async def text_only(self, url, **kwargs):
        assert url.endswith("/api/show")
        return httpx.Response(
            200, request=httpx.Request("POST", url), json={"capabilities": ["completion"]}
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", text_only)
    assert (await vision.status())["available"] is False


@pytest.mark.asyncio
async def test_local_failure_has_no_cloud_fallback(monkeypatch):
    monkeypatch.setenv("ROCK_VISION_PROVIDER", "ollama")

    async def fail(self, url, **kwargs):
        assert url.startswith("http://127.0.0.1:11434/")
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(httpx.AsyncClient, "post", fail)
    assert (await vision.status())["available"] is False
    with pytest.raises(HTTPException) as error:
        await vision.identify(
            vision.ScanInput.model_construct(photos=["data:image/jpeg;base64,test-image"])
        )
    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_second_scan_waits_for_the_first(monkeypatch):
    import asyncio

    monkeypatch.setenv("OLLAMA_VISION_MODEL", "qwen3-vl:2b")
    monkeypatch.setenv("ROCK_VISION_PROVIDER", "ollama")
    order = []

    async def respond(self, url, **kwargs):
        order.append("start")
        await asyncio.sleep(0.05)
        order.append("end")
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "done": True,
                "message": {
                    "content": json.dumps(
                        {"candidates": ["quartz"], "observations": "Clear.", "is_geological": True}
                    )
                },
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", respond)
    body = vision.ScanInput.model_construct(photos=["data:image/jpeg;base64,test-image"])
    results = await asyncio.gather(vision.identify(body), vision.identify(body))
    assert [r["candidate"] for r in results] == ["Quartz", "Quartz"]
    assert order == ["start", "end", "start", "end"]
