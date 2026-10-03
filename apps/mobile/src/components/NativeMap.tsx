import { useEffect, useRef } from "react";
import { Platform, Text, View } from "react-native";
import MapView, { Circle, Marker, Polygon, Polyline } from "react-native-maps";
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
  /** No place chosen yet: show the whole world without a pin. */
  world?: boolean;
  /** Mapped rock units and faults drawn over the imagery. */
  geology?: GeologyLayers;
};
export type GeologyLayers = {
  faults?: { type: string; paths: number[][][] }[];
  units?: { name: string; color: string; rings: number[][][] }[];
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
  world = false,
  geology,
}: MapProps) {
  const ref = useRef<MapView>(null);
  const span = world ? 140 : radiusKm ? spanFor(radiusKm) : 0.15;
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
      {geology?.units?.slice(0, 80).flatMap((u, i) =>
        u.rings.slice(0, 4).map((ring, j) => (
          <Polygon
            key={`u${i}-${j}`}
            coordinates={ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
            fillColor={`${u.color}66`}
            strokeColor={`${u.color}AA`}
            strokeWidth={0.5}
          />
        )),
      )}
      {geology?.faults?.slice(0, 120).flatMap((f, i) =>
        f.paths.map((path, j) => (
          <Polyline
            key={`f${i}-${j}`}
            coordinates={path.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
            strokeColor="#FF5A4E"
            strokeWidth={1.6}
          />
        )),
      )}
      {!world && (
        <Marker
          coordinate={{ latitude: location.lat, longitude: location.lng }}
          pinColor="#0B5D2D"
        />
      )}
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
