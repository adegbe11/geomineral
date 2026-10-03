# Scan connection

Sample photos are validated, resized to at most 1280 px, re-encoded without EXIF metadata, and stored with the private field record in the database. Existing records need no migration. Back up the database to retain photos. The current limit is three photos, each with a base64 payload below 3 MB. At larger scale, move these attachments to private object storage and paginate records.

Automatic identification defaults to local Ollama with `qwen3-vl:2b`. There are no paid API calls and no cloud fallback. Run `scripts/start-local-ai.ps1` to start the portable runtime after restarting the PC. Runtime files live in `.data/ollama-runtime/bin`, and model weights in `.data/ollama-models`. Both are excluded from Git. The one-time model download is about 1.9 GB. `OLLAMA_VISION_MODEL` can select a different installed vision model. The PC and GeoMineral API must remain running while scanning; this is not on-device inference on the phone. Local processing consumes CPU/RAM and can take several minutes.

For an explicitly selected paid provider only, set `ROCK_VISION_PROVIDER=openai`, `OPENAI_API_KEY` and `ROCK_VISION_MODEL` in the API process environment. Secrets must never be placed in Expo public variables or committed. The API does not automatically read `.env` files.

`GET /api/scan/status` verifies the installed local model has vision capabilities. For OpenAI it reports configuration availability, not provider health. `POST /api/scan` requires authentication, accepts photos only, strips metadata, and sends no account identity or selected coordinates. The Identify action discloses the processor. Local requests go exclusively to loopback port 11434; only one scan runs at a time to limit memory pressure. Optional OpenAI responses use `store: false`; this does not override that provider's abuse-monitoring policies. Results are tentative visual observations, never laboratory confirmation. Failed or incomplete responses return a retryable error.

Private photo saving remains available if the local model is stopped. Contract tests explicitly verify there is no paid fallback even when an OpenAI key exists. This general-purpose vision model has not been scientifically validated as a mineral identification system.

The local model examines the main (first) photo; additional photos are saved as supporting sample images. Qwen returns structured visual observations and a tentative mineral or rock name, without the previous fixed name whitelist. Non-geological or unidentified results show Unidentified. Truncated or malformed responses fail without saving a guessed identification. A compatibility adapter remains available for explicitly selected Moondream models. No label is inferred from filenames, location, or a fabricated confidence score.

This removes an artificial name restriction, not the limitations of visual identification. See [model research](mineral-model-research.md) and [local checks](local-vision-test.md) for observed failures and the small comparison set.

References: [Image inputs](https://developers.openai.com/api/docs/guides/images-vision), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
