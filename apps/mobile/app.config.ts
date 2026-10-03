import type { ExpoConfig } from "expo/config";
const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
// A test build pointed at a laptop API on the local network needs plain HTTP.
const cleartext = (process.env.EXPO_PUBLIC_API_ORIGIN ?? "").startsWith("http:");
const config: ExpoConfig = {
  name: "GeoMineral",
  slug: "geomineral",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "app.geomineral.explorer",
    buildNumber: "1",
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSMotionUsageDescription: "Lets crystals catch the light as you tilt your phone.",
    },
  },
  android: {
    package: "app.geomineral.explorer",
    versionCode: 1,
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#000000" },
    edgeToEdgeEnabled: true,
    ...(mapsKey ? { config: { googleMaps: { apiKey: mapsKey } } } : {}),
  },
  plugins: [
    ["react-native-maps", { androidGoogleMapsApiKey: mapsKey }],
    [
      "expo-splash-screen",
      { image: "./assets/splash-icon.png", imageWidth: 220, resizeMode: "contain", backgroundColor: "#000000" },
    ],
    [
      "expo-camera",
      {
        cameraPermission: "Photograph rocks for your private field observations.",
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
        locationWhenInUsePermission: "Select your current location for geological context.",
      },
    ],
    ["expo-audio", { microphonePermission: "Record voice notes for your field log." }],
    ["expo-build-properties", { android: { usesCleartextTraffic: cleartext } }],
    "expo-secure-store",
  ],
  web: { bundler: "metro", favicon: "./assets/favicon.png" },
};
export default config;
