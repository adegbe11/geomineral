import { useEffect, useRef } from "react";
import { Platform, Text, View } from "react-native";
import MapView, { Circle, Marker, Polygon } from "react-native-maps";
import { siteColor } from "../theme";
import type { Location, Occurrence } from "../types";
export type MapProps = {
  location: Location;
  onSelect: (p: Location) => void;
  satellite: boolean;
  polygon: number[][];
  drawing: boolean;
  radiusKm?: number;
  sites?: Occurrence[];
  selectedSite?: string;
  onSite?: (site: Occurrence) => void;
  interactive?: boolean;
};
// Fits the search circle with a little margin.
export const spanFor = (radiusKm = 25) => (radiusKm / 111) * 2.4;
export default function NativeMap({
  location,
  onSelect,
  satellite,
  polygon,
  drawing,
  radiusKm,
  sites = [],
  selectedSite,
  onSite,
  interactive = true,
}: MapProps) {
  const ref = useRef<MapView>(null);
  const span = radiusKm ? spanFor(radiusKm) : 0.15;
  useEffect(() => {
    ref.current?.animateToRegion(
      {
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: span,
        longitudeDelta: span,
      },
      500,
    );
  }, [location.lat, location.lng, span]);
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
      mapType={satellite ? "hybrid" : "standard"}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
      initialRegion={{
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: span,
        longitudeDelta: span,
      }}
      onPress={(e) => {
        if (!interactive || e.nativeEvent.action === "marker-press") return;
        onSelect({
          lat: e.nativeEvent.coordinate.latitude,
          lng: e.nativeEvent.coordinate.longitude,
          name: drawing ? "Area vertex" : "Selected map location",
        });
      }}
    >
      {!!radiusKm && (
        <Circle
          center={{ latitude: location.lat, longitude: location.lng }}
          radius={radiusKm * 1000}
          strokeColor="#F2D27Acc"
          fillColor="#F2D27A14"
          strokeWidth={1.5}
        />
      )}
      {sites.map((o) => (
        <Marker
          key={selectedSite === o.id ? `${o.id}-on` : o.id}
          coordinate={{ latitude: o.lat, longitude: o.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          onPress={() => onSite?.(o)}
        >
          <View
            style={{
              width: selectedSite === o.id ? 18 : 12,
              height: selectedSite === o.id ? 18 : 12,
              borderRadius: 9,
              backgroundColor: siteColor(o.status),
              borderWidth: 2,
              borderColor: "#fff",
            }}
          />
        </Marker>
      ))}
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
