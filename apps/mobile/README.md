# GeoMineral native app

React Native + Expo implementation with Earth onboarding, Home, Explore, Scan, Projects and Profile tabs. Analysis, educational mineral guides, sample notes and PDF reports use native views. There is no WebView dependency.

## Run

Install with `npm install --prefix apps/mobile`. Copy `.env.example` to `.env` in this directory and set `EXPO_PUBLIC_API_ORIGIN` to the backend. Physical devices need a reachable LAN address in development; production requires HTTPS. Android emulators can use `http://10.0.2.2:8000`. Configure `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` for Android maps, restricted to the package and signing certificate. iOS uses Apple Maps.

Run `npm start --prefix apps/mobile` for a compatible Expo development client. A signed build and installed native modules are required for full native validation. Run `npm run web --prefix apps/mobile` for the same React Native screens rendered in a phone-width browser preview on port 8081. Add that exact preview origin to the API's `ALLOWED_ORIGINS`. The separate desktop web application remains on port 3000.

## Device capabilities

Camera, photo picker and foreground location request permissions on explicit actions. Native session tokens use Expo SecureStore; browser preview sessions use sessionStorage. Maps use react-native-maps on devices and a separate MapLibre adapter for browser preview. PDF export uses Expo Print and the native share sheet. Saved polygon boundaries do not change the analysis radius, which remains 25 km around the selected pin.

Sample photos and notes save to private projects. Scan uses a local Ollama vision model on the API computer by default, without paid API calls; see [Scan connection](../../docs/scan-connection.md). The model must be downloaded and running. Its suggestions are unconfirmed visual observations, not laboratory identification. Browser PDF export downloads a real PDF; native export opens the share sheet. Offline synchronization and app-store signing remain outstanding. Maps require provider coverage and Android configuration. Physical iOS/Android permission flows and performance still require device testing; JS bundle export does not constitute a signed app build.

Earth artwork: NASA/JPL PIA18033, https://science.nasa.gov/photojournal/earth/. Mineral illustrations are original geometric SVGs, not specimen photographs.
