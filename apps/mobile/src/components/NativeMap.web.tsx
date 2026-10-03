import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapProps } from "./NativeMap";
export default function NativeMap({
  location,
  onSelect,
  satellite,
  polygon,
}: MapProps) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    callback = useRef(onSelect);
  callback.current = onSelect;
  const [error, setError] = useState("");
  useEffect(() => {
    if (!host.current) return;
    const m = new maplibregl.Map({
      container: host.current,
      center: [location.lng, location.lat],
      zoom: 11,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          base: {
            type: "raster",
            tiles: [
              satellite
                ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
          },
        },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
    });
    map.current = m;
    m.on("click", (e) =>
      callback.current({
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
        name: "Selected map location",
      }),
    );
    m.on("error", () =>
      setError("Map imagery is unavailable. Search still works."),
    );
    return () => {
      m.remove();
      map.current = null;
    };
  }, [satellite]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.flyTo({ center: [location.lng, location.lat], duration: 500 });
    const marker = new maplibregl.Marker({ color: "#0B5D2D" })
      .setLngLat([location.lng, location.lat])
      .addTo(m);
    return () => {
      marker.remove();
    };
  }, [location, satellite]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const update = () => {
      const data: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [polygon.length >= 3 ? [...polygon, polygon[0]] : []],
        },
      };
      const source = m.getSource("area") as
        maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        m.addSource("area", { type: "geojson", data });
        m.addLayer({
          id: "area",
          type: "fill",
          source: "area",
          paint: { "fill-color": "#D6B65D", "fill-opacity": 0.3 },
        });
      }
    };
    if (m.isStyleLoaded()) update();
    else m.once("load", update);
    return () => {
      m.off("load", update);
    };
  }, [polygon, satellite]);
  return (
    <View style={{ flex: 1 }}>
      <div ref={host} style={{ position: "absolute", inset: 0 }} />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 4,
          left: 4,
          backgroundColor: "#ffffffdd",
          padding: 3,
        }}
      >
        <Text style={{ fontSize: 8 }}>
          {error ||
            (satellite
              ? "Imagery © Esri and contributors"
              : "© OpenStreetMap contributors")}
        </Text>
      </View>
    </View>
  );
}
