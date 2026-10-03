"""Optional live smoke check against the local app and model; no cloud requests."""

import base64
import io
import json
import time
from pathlib import Path

import httpx
from PIL import Image, ImageDraw


def main():
    output = Path(".data/vision-smoke")
    output.mkdir(parents=True, exist_ok=True)
    blank = Image.new("RGB", (256, 256), "white")
    ImageDraw.Draw(blank).rectangle((50, 50, 200, 200), fill="blue")
    buffer = io.BytesIO()
    blank.save(buffer, "PNG")
    images = [("non-rock", "png", buffer.getvalue())]
    rock = output / "granite.jpg"
    if rock.exists():
        images.append(("granite", "jpeg", rock.read_bytes()))
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=240, trust_env=False) as client:
        assert client.get("/api/scan/status").json() == {"available": True, "provider": "ollama"}
        account = client.post(
            "/api/mobile/auth/register",
            json={
                "email": f"local-smoke-{time.time_ns()}@example.test",
                "password": "synthetic-local-smoke-only-passphrase",
            },
        )
        account.raise_for_status()
        client.headers["Authorization"] = "Bearer " + account.json()["token"]
        results = []
        for name, kind, data in images:
            started = time.monotonic()
            response = client.post(
                "/api/scan",
                json={"photos": [f"data:image/{kind};base64," + base64.b64encode(data).decode()]},
            )
            result = {
                "fixture": name,
                "status": response.status_code,
                "seconds": round(time.monotonic() - started, 1),
                "result": response.json(),
            }
            print(json.dumps(result), flush=True)
            results.append(result)
            (output / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
            response.raise_for_status()
        client.post("/api/auth/logout", json={})


if __name__ == "__main__":
    main()
