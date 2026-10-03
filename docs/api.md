# API

OpenAPI is served at `/openapi.json`; interactive documentation is available at `/docs` on the API origin.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/health` | Process health and version |
| POST | `/api/auth/register` | Create account and HTTP-only session |
| POST | `/api/auth/login` | Authenticate and issue revocable session |
| POST | `/api/auth/logout` | Revoke current session |
| GET | `/api/auth/me` | Current identity or null |
| GET | `/api/search?q=` | Explicit-submission place or coordinate search |
| POST | `/api/analyses` | Queue point assessment; returns 202 and ID |
| GET | `/api/analyses/{id}` | Owner-scoped progress and result |
| GET/POST | `/api/projects` | List or create private projects |
| GET | `/api/projects/{id}` | Project and private field records |
| POST | `/api/projects/{id}/records` | Add observation or sample |
| GET | `/api/projects/{id}/report` | Structured private report |
| GET | `/api/datasets` | Source metadata and enable state |
| PATCH | `/api/admin/datasets/{id}` | Admin-only provider state change |

## Example

```json
{"location":{"name":"Selected location","lat":6.9,"lng":6.1},"radius_km":25}
```

The response is `{"id":"…","status":"queued"}`. Poll that ID with the same session cookies. An analysis can be `queued`, `processing`, `complete` or `failed`. Source failure is usually a completed assessment with explicit limited coverage, not fabricated evidence.

Project input supports `name`, `location`, optional `analysis_id`, and optional polygon vertices as `[longitude, latitude]` pairs. Project polygons are validated and area is calculated geodesically. Drawing an area conveys no ownership rights.

## Security boundary

- Scrypt salted password hashes; random session tokens stored only as hashes, seven-day expiry, server-side logout revocation.
- HTTP-only, SameSite=Lax cookies; production requires Secure cookies and PostgreSQL.
- Origin and cross-site checks on mutations; no wildcard credentialed CORS.
- Private API responses use `Cache-Control: no-store`.
- Accounts cannot self-assign admin roles; other owners' IDs return 404.
- Analysis results are limited to their authenticated owner or originating guest cookie.
- Pydantic input validation, bounded coordinates/radius/strings/polygon vertices, request-size guard and per-process write throttling.
- No uploaded code, arbitrary URLs, credentials or project data are sent to an LLM.

Production still needs shared rate limiting, password reset, verified email/account recovery, managed secret rotation, dependency/security review, audit retention and independent penetration testing. Do not claim this development security baseline is a completed production security review.
