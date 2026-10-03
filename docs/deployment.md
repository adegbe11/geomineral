# Deployment and operations

## Containers

Requires Docker Compose and a TLS reverse proxy. Set `POSTGRES_PASSWORD` (URL-safe, unique secret), `PUBLIC_ORIGIN=https://your-host`, and a meaningful `PROVIDER_USER_AGENT` in a secret-managed environment. Never commit real credentials.

```sh
docker compose build
docker compose up -d
```

Compose starts PostgreSQL/PostGIS, applies numbered migrations, then starts the API, SQL analysis worker and web application. Only web port 3000 is bound, on loopback. Terminate HTTPS at a reverse proxy and forward to that port. API and database remain internal. Secure session cookies deliberately do not work over public HTTP.

The web proxy origin is compiled at build time. Docker supplies `http://api:8000`; set the build argument when using a different topology. Restrict reverse-proxy request bodies, set sensible timeouts, security headers and shared rate limits. Use separate migration and least-privilege runtime database roles before launch; the development Compose bundle does not provision those roles automatically.

## Operations

- Check `/api/health`, queue age, worker liveness, provider errors and database connections. The health endpoint currently reports API process health only, not aggregate dependency health.
- Logs identify provider errors and failed run IDs without logging passwords or cookie tokens.
- Configure encrypted backups and exercise restoration. Set retention policies for guest analyses, expired sessions, logs and project snapshots.
- Operator admin assignment: with `PYTHONPATH=services/api`, run `python scripts/promote_admin.py user@example.com` after the intended account is registered. There is no seeded superuser.
- Do not bulk-harvest Nominatim or use the public endpoint as a high-volume production backend. Configure a contracted/self-hosted geocoder and shared rate limiting.
- Verify imagery service usage terms before production scale, caching or offline distribution. No tile prefetching/offline packs are implemented.
- The image service and object storage are not configured. A future integration must use private object storage, expiring signed URLs, MIME/content validation and per-project authorization.

## Verification status

Local web build, Python unit/integration tests and browser workflows can be executed as documented in README. Docker/PostGIS execution requires Docker, which was not available in the initial build environment. Container and migration files must be exercised in staging before deployment. No site was published and no cloud resources were provisioned.
