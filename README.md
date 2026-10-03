# GeoMineral

**Explore Earth. Understand the geology. Follow the evidence.**

A working first vertical slice of the GeoMineral brief: responsive Next.js application, FastAPI service, durable analysis worker, live source adapters, private projects and field records. This is an engineering foundation, **not a launch-certified production system or a scientifically validated prospectivity model**.

## Implemented

- Global place search and coordinate search; MapLibre satellite/street maps, drop pins, GPS and project polygons.
- Live Macrostrat geological map queries and USGS MRDS occurrence queries, bounded timeouts and explicit outage/empty/disabled states.
- Conservative candidate screening, categorical prospectivity, separate evidence quality, source snapshots, original map references and a reproducibility fingerprint.
- Queued/processing/complete/failed analyses in a separate SQL-backed worker.
- Email/password accounts with scrypt, revocable HTTP-only sessions, origin checks and server-enforced private project access.
- Projects, geodesic polygon area, observations, sample records, private printable web reports.
- Simple/professional explanations, source registry, operator-assigned admin provider controls.
- Responsive mobile interface, educational mineral cards and a local photo observation workspace.
- PostgreSQL/PostGIS deployment schema, numbered migrations, container definitions, tests and CI.

**Explicit gaps:** native Scan saves private sample photos and includes a server-side vision adapter; free local identification uses Ollama and an installed vision model; accuracy evaluation remains outstanding. See [Scan connection](docs/scan-connection.md). The desktop photo workspace remains local-only. Offline sync, fully native map/field tools, S3 uploads, assay ingestion, target generation, comprehensive country adapters and professional cartographic PDF reports remain future work. The basic report can be printed to PDF by the browser. A point analysis does not analyze a polygon's full geological extent. See [delivery status](docs/status.md).

The [native Expo app](apps/mobile/README.md) implements onboarding, five bottom tabs, native maps, camera/photo capture, private projects, sample notes, geological analysis and PDF sharing. Native tokens use SecureStore. Device validation and signed releases remain outstanding.

## Local development (Windows)

Requires Node.js 24+ and Python 3.12+. No paid API keys are needed for the connected public services.

```powershell
npm.cmd ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r services/api/requirements.lock.txt
```

Run these in **three separate terminals**, from the repository root:

```powershell
.\scripts\serve.ps1 api
.\scripts\serve.ps1 worker
.\scripts\serve.ps1 web
```

Open <http://127.0.0.1:3000>. API docs: <http://127.0.0.1:8000/docs>.

The development database is `.data/geomineral.db`. Do not commit it. SQLite is a local convenience only; PostgreSQL/PostGIS is the deployment target. Projects and field records require an account. Analysis is also available to guests with a private session cookie. No demo users, passwords, fabricated geological records or API keys are seeded into the application.

On macOS/Linux, set `PYTHONPATH=services/api`, then run `.venv/bin/python -m uvicorn geomineral.main:app --host 127.0.0.1 --port 8000` and `.venv/bin/python -m geomineral.worker`; use `npm run dev` for the web server.

Configuration is documented in `.env.example`. API settings are read from process environment variables (not automatically from `.env`). For local development, use `$env:NAME='value'` before launching both API and worker. Docker Compose reads the root `.env` file. The web proxy defaults to `http://127.0.0.1:8000`; set `API_ORIGIN` before building if needed.

## Validation

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check services/api
.\.venv\Scripts\ruff.exe format --check services/api
npm.cmd run typecheck
npm.cmd run build
# With API and web servers running:
npm.cmd run test:e2e
```

Browser tests use Microsoft Edge by default on Windows. For bundled Chromium: `npx playwright install chromium`, set `PLAYWRIGHT_CHANNEL=chromium`, then run the tests. They create synthetic test accounts/projects on the local API. Use a disposable `DATABASE_URL` for test-only runs. Backend tests use an isolated in-memory database and explicitly synthetic provider fixtures; they require no upstream network access.

## Documentation

- [Architecture and evidence methodology](docs/architecture.md)
- [Database and migrations](docs/database.md)
- [API and security boundaries](docs/api.md)
- [Deployment and operating notes](docs/deployment.md)
- [Implemented scope and launch blockers](docs/status.md)
- [Regional validation plan](docs/regions.md)
- [Verification results](docs/verification.md)

## Source attribution

Geological data: [Macrostrat](https://macrostrat.org), CC BY 4.0; original map citations are preserved per feature. Historical occurrences: [USGS MRDS](https://mrdata.usgs.gov/mrds/), with upstream accuracy and completeness limitations. Place search and street maps: OpenStreetMap contributors. Satellite imagery: Esri and the contributors listed on the map. Source availability is not a promise of detailed global coverage. See provider metadata before reusing source material.
