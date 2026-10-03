# Launch

## Test APK (Android, today)

Laptop running the API and worker on the same Wi-Fi as the phone.

```sh
cd apps/mobile
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Install the APK from the link EAS returns. The `preview` profile points at `http://10.88.26.236:8000`; update `eas.json` if the laptop's address changes.

## Server

1. Host with Docker Compose behind HTTPS (`docs/deployment.md`).
2. Secrets: `POSTGRES_PASSWORD`, `PUBLIC_ORIGIN=https://<host>`, `PROVIDER_USER_AGENT="GeoMineral/1.0 (<contact email>)"`.
3. Optional keys: `OPENALEX_API_KEY` (full-text research), `OPENAI_API_KEY` + `ROCK_VISION_MODEL` (cloud scanner).
4. `PROXY_HOPS` matches the proxies in front of the API (Compose default: 2).
5. Own geocoder (`GEOCODER_URL`) before heavy traffic; public Nominatim is light use only.
6. Backups restored once before launch.

## Store builds

1. `EXPO_PUBLIC_API_ORIGIN=https://<host>` as an EAS environment variable for `production`.
2. `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (Android maps, restricted to `app.geomineral.explorer`).
3. `npx eas-cli build --platform all --profile production`
4. `npx eas-cli submit --platform android` / `--platform ios`

## Store listing

- Name: GeoMineral
- Subtitle: Find hidden minerals around you.
- Category: Education (secondary: Reference)
- Privacy: location (in use), camera, photos, microphone (voice notes); account email; no tracking, no ads.
- Privacy policy and support URLs on the public site.
- Screenshots: Home, Explore result, Potential Zones, Scan, Rockdex.

## Gate

```sh
.venv/Scripts/ruff check services/api
cd services/api && python -m pytest -q
cd apps/mobile && npx tsc --noEmit && npx expo-doctor
npx playwright test -c playwright.mobile.config.ts
npm run audit:mobile
```
