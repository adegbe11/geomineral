# Architecture

## Boundaries

`apps/web/src/components` contains map, search, analysis, projects, photo observation and modal components. `lib/types.ts` defines the typed client contracts. `lib/api.ts` centralizes same-origin authenticated transport. The web application forwards `/api/*` to the FastAPI service; credentials never need to be exposed to JavaScript.

`services/api/geomineral` contains Pydantic schemas, source adapters, geospatial primitives, conservative analysis rules, authorization, SQLAlchemy persistence, HTTP endpoints and a separate worker. Field records are not automatically promoted to verified geological evidence.

The source registry is currently code-configured. Persisted `dataset_states` allows administrators to enable or disable known adapters. The production `data_sources` catalogue stores the full registry metadata; it is seeded by migration. Arbitrary database URLs are intentionally not executable adapter definitions. Adding a provider requires a reviewed adapter and matching registry migration.

## Analysis lifecycle

1. Resolve a searched place or validate WGS84 coordinates. Country code is taken from geocoder metadata when available; dropped pins have an unknown jurisdiction, not an invented one.
2. Persist an immutable analysis request with a unique ID and access owner.
3. A separate worker atomically claims the oldest queued request.
4. Query baseline providers concurrently, with 18-second timeouts and isolated failures. Country adapters can be registered in `COUNTRY_PROVIDERS`; none are claimed to be connected yet.
5. Preserve source attributes and citations, normalize reported geology and nearby occurrence evidence, and compute geodesic distances.
6. Generate candidates from explicit mapped industrial-mineral lithologies or normalized occurrence commodities.
7. Apply independent commodity screening rules. Regional metal occurrences alone return **Insufficient evidence** for local prospectivity. Explicit mapped limestone, gypsum or claystone can trigger a **Moderate** screening category with **Limited** evidence. These provisional rules require geoscientist review before public launch.
8. Keep contradictory evidence separate from missing information. Negative evidence prevents a favorable local classification. No evidence produces no candidates, not a false low/zero probability.
9. Persist output, input, model version, source snapshots, retrieval timestamps and SHA-256 evidence fingerprint. Explanations are deterministic templates rather than ungrounded LLM text.
10. Poll progress, display evidence and save a reference in a private project.

Each run has its own snapshot; the application does not silently overwrite analysis history. Upstream dataset versions are marked unspecified when absent. Retrieval time and content fingerprint are available but are not substituted for an upstream release identifier.

## Worker and caching

The MVP uses an atomic SQL queue instead of introducing Redis/Celery operational dependencies. Interrupted claims become eligible again after 180 seconds. Public provider calls are shorter than that lease; large geoprocessing is not implemented. Production worker deployment and crash recovery require soak testing.

Analyses are deliberately not cached before upstream dataset version semantics are established. The geocoder has a one-hour, bounded process-local cache and at most one request per 1.1 seconds. A multi-replica deployment must replace this with shared rate limiting and a geocoder licensed for expected volume.

## Geospatial semantics

WGS84 longitude/latitude is used for storage. `pyproj.Geod` computes ellipsoidal distance and area. Shapely validates project polygons. Production PostGIS geometry columns and GiST indexes support spatial querying; use geography casts for metre-based distance and area. Polygon analysis is not implemented: saving a polygon does not turn its associated point result into an area-wide assessment.

## Intentional next boundaries

The Expo app uses native React Native screens and platform map, camera, location, print and sharing modules. Mobile endpoints return revocable bearer sessions stored in SecureStore; the browser preview uses sessionStorage. Private photos are stored with field records; a local Ollama adapter supplies tentative visual identification without API fees (OpenAI is opt-in only) (see scan-connection.md). Signed S3 upload workflows, vector geological overlays, jurisdiction rules, evidence ingestion and full polygon analysis remain separate future integrations. No mocked external service is represented as live. Dataset licensing must be reviewed before materializing third-party data or offline tile packs.
