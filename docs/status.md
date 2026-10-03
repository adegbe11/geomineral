# Delivery status and launch gates

The delivered application is a functional web MVP foundation. This file distinguishes implemented behavior from the entire requested product roadmap.

| Brief area | Current implementation |
| --- | --- |
| Authentication | Local email/password accounts, session revocation and private authorization; email recovery/verification outstanding |
| Search and map | Live place search, coordinates, satellite/street map, drop pin, GPS, polygon drawing |
| Global geology | Live Macrostrat adapter; variable coverage, original map attributes retained |
| Occurrences | Live USGS MRDS adapter, radial query and ellipsoidal distances; historical limitations visible |
| Country architecture | Adapter registry; no country-specific regulatory provider claimed |
| Analysis | Durable worker, versioned snapshots, evidence UI, conservative rule-based candidates |
| Model validity | Provisional screening, not a validated professional prospectivity model |
| Projects | Private saved locations, polygons and attached point analyses |
| Fieldwork | Private observations and samples with coordinates, timestamp and custody notes |
| Photo identification | Native photos persist privately; free local Ollama adapter and contract tests implemented; model runtime must be running, scientific accuracy validation remains outstanding |
| Reports | Printable web summary, source metadata, limitations and field records; no cartographic map report generator |
| Professional mode | Raw source attributes, normalized evidence and model fingerprint |
| Admin | Source registry and operator-assigned provider controls |
| Native mobile | React Native + Expo screens, native map/camera/location, SecureStore auth, project/sample notes and PDF sharing; private photo persistence implemented; device testing and offline sync remain outstanding |
| PostGIS | Migration and container architecture; local runtime tested on SQLite |
| S3 / offline / lab assays / targets | Not yet implemented; no dummy integrations presented as working |

Before a public release: geoscientist validation across the region matrix; complete licence/use review; production PostGIS and migration integration tests; shared abuse controls; account recovery; privacy/data-retention flows; least-privilege database roles; worker recovery/scale tests; accessibility audit; object storage and vetted rock identification if those features are advertised. The long-term 3D/drilling/community/enterprise scope remains outside this MVP.
