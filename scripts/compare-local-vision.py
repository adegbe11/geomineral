"""Evaluate an installed local model on reference images; never sends photos to cloud."""

import argparse
import asyncio
import base64
import io
import json
import os
import time
from pathlib import Path

from geomineral.vision import ScanInput, identify
from PIL import Image, ImageDraw


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    args = parser.parse_args()
    os.environ["ROCK_VISION_PROVIDER"] = "ollama"
    os.environ["OLLAMA_VISION_MODEL"] = args.model
    folder = Path(".data/vision-smoke")
    control = Image.new("RGB", (256, 256), "white")
    ImageDraw.Draw(control).rectangle((50, 50, 200, 200), fill="blue")
    buffer = io.BytesIO()
    control.save(buffer, "JPEG")
    fixtures = [("non-rock", buffer.getvalue())]
    for name in ("pyrite", "malachite", "amethyst", "granite"):
        path = folder / (name + ".jpg")
        if path.exists():
            fixtures.append((name, path.read_bytes()))
    results = []
    for name, photo in fixtures:
        body = ScanInput(photos=["data:image/jpeg;base64," + base64.b64encode(photo).decode()])
        start = time.monotonic()
        try:
            result = await identify(body)
        except Exception as error:
            result = {"error": str(error)}
        row = {"fixture": name, "seconds": round(time.monotonic() - start, 1), "result": result}
        print(json.dumps(row), flush=True)
        results.append(row)
        target = folder / (args.model.replace(":", "-").replace("/", "-") + "-results.json")
        target.write_text(json.dumps({"model": args.model, "results": results}, indent=2))


asyncio.run(main())
