import type { ExpoConfig } from "expo/config";
const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const config: ExpoConfig = {
  name: "GeoMineral",
  slug: "geomineral",
  version: "0.2.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: { supportsTablet: true, bundleIdentifier: "app.geomineral.explorer" },
  android: {
    package: "app.geomineral.explorer",
    ...(mapsKey ? { config: { googleMaps: { apiKey: mapsKey } } } : {}),
  },
  plugins: [
    ["react-native-maps", { androidGoogleMapsApiKey: mapsKey }],
    [
      "expo-camera",
      {
        cameraPermission:
          "Photograph rocks for your private field observations.",
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Choose rock photos for your field observations.",
        microphonePermission: false,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Select your current location for geological context.",
      },
    ],
    "expo-secure-store",
  ],
  web: { bundler: "metro" },
};
export default config;
