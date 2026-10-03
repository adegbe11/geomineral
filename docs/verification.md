# Verification record

Initial implementation verified on Windows, 16 September 2026.

| Check | Result |
| --- | --- |
| Python domain/API/worker tests | 24 passed; isolated database and synthetic fixtures |
| Python static checks and formatting | Passed |
| Web strict TypeScript check | Passed, including unused-local checks |
| Next.js production build | Passed |
| Desktop and mobile browser workflows | 4 passed |
| Expo TypeScript check | Passed |
| Expo iOS JavaScript/Hermes export | Passed, 596 modules bundled |
| Live baseline providers | Queried all eight regions; results in `validation-live.json` |
| Live place-name geocoder | Accra lookup returned coordinates and country code |

Browser tests cover search, account creation, private project saving, observations, web reports, basemap controls, photo-service fallback and mobile horizontal overflow. Backend tests cover account isolation, session revocation, admin denial, guest isolation, analysis/location consistency, source failure isolation, queued processing, coordinate bounds, geodesic distance/area, invalid polygons and conservative evidence semantics.

The Pacific control returned empty results from both connected geological providers, with no generated commodity candidates. Uhonmora returned geological map records but no MRDS records in the requested radius. These observations demonstrate source behavior at test time; they are not an independent geological assessment or guarantee of completeness.

Not verified in this environment: PostgreSQL/PostGIS migration execution (Docker unavailable), container deployment, native iOS/Android runtime, native permissions, app-store signing, production load/security review, comprehensive accessibility audit and scientific validation of the screening rules. The Expo export is a JavaScript bundle, not a signed native app.

Two upstream test-client deprecation warnings remain (Starlette/httpx and anyio); tests pass. Local browser test records use synthetic `example.test` accounts.

## Native app rebuild - 16 September 2026

The WebView shell has been replaced with native Expo screens. Backend suite: 26 tests passed, including bearer-session revocation and guest header isolation. React Native TypeScript check passed. Browser preview checks cover native-screen navigation, safe camera state, coordinate search through live analysis/report, and native account creation/private project saving/sign-out. iOS and Android Hermes export both succeeded; these are JavaScript bundles, not signed APK/IPA files. Physical-device permissions, maps configuration, PDF sharing and camera capture remain unverified on a device.

Visual refinement: cinematic Earth Home, contour field-tool cards, floating Expo Blur navigation and full-screen map controls. TypeScript and all 3 mobile browser workflows pass after the redesign; iOS and Android Hermes exports also pass. Native blur appearance still requires device review. Design references: https://www.apple.com/os/ios/ and https://developer.apple.com/design/human-interface-guidelines/materials .

Mineral Guide update: restored Home headline and strengthened overlay contrast. Nine source-linked educational mineral profiles support name/formula/group/commodity search, group filters, Home profile links, analysis-to-library links, optional suspected minerals in scanner notes, and direct sample records in private projects. Lab-confirmed records require a user-entered reference and are explicitly user-reported. Sample status/reference are stored using existing method, description and chain_of_custody fields; no automatic laboratory verification or database migration is claimed. Full global mineral coverage remains future work. Browser verification covers formula search, profile opening, reference-required validation, saved suspected samples and project-to-profile navigation.
