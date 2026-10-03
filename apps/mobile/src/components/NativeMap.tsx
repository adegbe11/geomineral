import { useEffect, useRef } from "react";
import { Platform, Text, View } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import type { Location } from "../types";
export type MapProps = {
  location: Location;
  onSelect: (p: Location) => void;
  satellite: boolean;
  polygon: number[][];
  drawing: boolean;
};
export default function NativeMap({
  location,
  onSelect,
  satellite,
  polygon,
  drawing,
}: MapProps) {
  const ref = useRef<MapView>(null);
  useEffect(() => {
    ref.current?.animateToRegion(
      {
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      },
      500,
    );
  }, [location.lat, location.lng]);
  if (
    Platform.OS === "android" &&
    !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  ) {
    return (
      <View style={{ flex: 1, padding: 30, justifyContent: "center" }}>
        <Text style={{ color: "#DCE9DE", textAlign: "center", lineHeight: 23 }}>
          Map imagery is not configured for this Android build. You can still
          search for a location and analyze it.
        </Text>
      </View>
    );
  }
  return (
    <MapView
      ref={ref}
      style={{ flex: 1 }}
      mapType={satellite ? "satellite" : "standard"}
      initialRegion={{
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      }}
      onPress={(e) =>
        onSelect({
          lat: e.nativeEvent.coordinate.latitude,
          lng: e.nativeEvent.coordinate.longitude,
          name: drawing ? "Area vertex" : "Selected map location",
        })
      }
    >
      <Marker
        coordinate={{ latitude: location.lat, longitude: location.lng }}
        pinColor="#0B5D2D"
      />
      {polygon.length >= 3 && (
        <Polygon
          coordinates={polygon.map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          }))}
          fillColor="#C9A34B44"
          strokeColor="#D6B65D"
          strokeWidth={2}
        />
      )}
    </MapView>
  );
}
