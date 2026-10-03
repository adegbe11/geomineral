# Local vision checks

Run `scripts/check-local-scan.py` using the API virtual environment after starting Ollama and downloading the model. This makes live calls to the local GeoMineral API with a synthetic account. It checks a blue square (non-geological control) and, when present, the sample at `.data/vision-smoke/granite.jpg`. Outputs go to `.data/vision-smoke/results.json`; no user photos or credentials are logged.

Granite test photo: Eurico Zimbres, [Granite.jpg on Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Granite.jpg), [CC BY-SA 2.0 Brazil](https://creativecommons.org/licenses/by-sa/2.0/br/). Original image downloaded unchanged for local testing; the app normalizes images before inference. The model receives image bytes only, not this label or attribution.

These smoke checks establish connectivity and inspect two examples. They are not a scientific accuracy evaluation or proof that all minerals can be identified from photos.

Verified on 2026-09-16 with local Ollama 0.34.1 and Moondream 1.8B: the app API returned Unidentified for the blue square and Granite for the reference photograph. The final warm runs took 6.8 and 11.8 seconds respectively; earlier uncached image queries took roughly 20-30 seconds. Latency depends on CPU load, memory, and cache state. A plain description prompt is followed by a rock-type question only when the first description mentions geological material without naming it; this small model performed poorly with a forced JSON prompt.


## Qwen3-VL comparison (2026-09-16)

Qwen3-VL 2B (`0635d9d857d497aeadba3d7d27485746c50554446f9f6ec01ef39788221adbe8`) was installed through Ollama with digest verification and selected as the app default after the following smoke comparison. All inference ran locally on this CPU. Reference names were not sent with images.

| Fixture | Moondream 1.8B | Qwen3-VL 2B | Qwen elapsed |
| --- | --- | --- | --- |
| Blue square | Unidentified | Unidentified | 70.0 s |
| Pyrite | Unidentified | Copper (incorrect) | 65.3 s |
| Malachite | Shale (incorrect) | Malachite | 66.5 s |
| Amethyst | Unidentified | Amethyst | 69.2 s |
| Granite | Granite | Granite | 77.9 s |

This is an improvement on this small comparison set, not a benchmark accuracy claim. Qwen still confused pyrite with copper and produces repetitive descriptions despite concise prompting. It is not validated for thousands of minerals. Results remain Suggested / Unconfirmed. Image similarity does not establish composition, purity or an underground deposit.

Mineral reference thumbnails came from Wikipedia's page-summary image sources: [Pyrite](https://en.wikipedia.org/wiki/Pyrite), [Malachite](https://en.wikipedia.org/wiki/Malachite), [Amethyst](https://en.wikipedia.org/wiki/Amethyst). Exact source URLs are retained in `.data/vision-smoke/mineral-sources.json`; files are local test inputs, not bundled product assets. Granite attribution is above.

To repeat the comparison: set `PYTHONPATH=services/api`, then run `.venv/Scripts/python.exe scripts/compare-local-vision.py --model qwen3-vl:2b`. Moondream remains installed for comparison via `--model moondream:1.8b`. Outputs retain fixture-level results and timing. For the browser workflow, set `LIVE_LOCAL_SCAN=1`, optionally `LIVE_SCAN_IMAGE` to a local photo and `LIVE_SCAN_EXPECTED` to an exact candidate label, then run `npm run test:mobile`.

The Ollama build tested sometimes returns schema-constrained Qwen JSON in `message.thinking` with an empty `message.content`. The adapter accepts that field only when it is a complete valid result object; arbitrary reasoning prose is never displayed. Tests cover this compatibility behavior and reject malformed or truncated output.
