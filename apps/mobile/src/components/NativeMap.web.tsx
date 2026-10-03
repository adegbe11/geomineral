import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { siteColor } from "../theme";
import type { MapProps } from "./NativeMap";

const circle = (lng: number, lat: number, km: number) => {
  const ring = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    ring.push([
      lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a),
      lat + (km / 110.57) * Math.sin(a),
    ]);
  }
  return ring;
};

export default function NativeMap({
  location,
  onSelect,
  satellite,
  polygon,
  radiusKm,
  sites = [],
  selectedSite,
  onSite,
  interactive = true,
}: MapProps) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    callback = useRef(onSelect),
    siteCallback = useRef(onSite),
    siteList = useRef(sites);
  callback.current = onSelect;
  siteCallback.current = onSite;
  siteList.current = sites;
  const [error, setError] = useState(""),
    [loaded, setLoaded] = useState(0);
  useEffect(() => {
    if (!host.current) return;
    setLoaded(0);
    const m = new maplibregl.Map({
      container: host.current,
      center: [location.lng, location.lat],
      zoom: radiusKm ? 9 : 11,
      attributionControl: false,
      interactive,
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
    m.on("click", (e) => {
      const hit = m.queryRenderedFeatures(e.point, { layers: ["sites"] })[0];
      if (hit) {
        const site = siteList.current.find(
          (o) => o.id === hit.properties?.id,
        );
        if (site) siteCallback.current?.(site);
        return;
      }
      if (interactive)
        callback.current({
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          name: "Selected map location",
        });
    });
    m.on("load", () => {
      m.addSource("radius", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "radius-fill",
        type: "fill",
        source: "radius",
        paint: { "fill-color": "#F2D27A", "fill-opacity": 0.08 },
      });
      m.addLayer({
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: { "line-color": "#F2D27A", "line-width": 1.5 },
      });
      m.addSource("area", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "area",
        type: "fill",
        source: "area",
        paint: { "fill-color": "#D6B65D", "fill-opacity": 0.3 },
      });
      m.addSource("sites", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "sites",
        type: "circle",
        source: "sites",
        paint: {
          "circle-radius": ["case", ["get", "selected"], 9, 6],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
      m.on("mouseenter", "sites", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "sites", () => (m.getCanvas().style.cursor = ""));
      setLoaded((n) => n + 1);
    });
    m.on("error", () =>
      setError("Map imagery is unavailable. Search still works."),
    );
    return () => {
      m.remove();
      map.current = null;
    };
  }, [satellite, interactive]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (radiusKm) {
      const ring = circle(location.lng, location.lat, radiusKm);
      const lngs = ring.map((p) => p[0]),
        lats = ring.map((p) => p[1]);
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        {
          padding: interactive
            ? { top: 200, bottom: 330, left: 16, right: 16 }
            : 12,
          duration: 500,
        },
      );
    } else m.flyTo({ center: [location.lng, location.lat], duration: 500 });
    const marker = new maplibregl.Marker({ color: "#0B5D2D" })
      .setLngLat([location.lng, location.lat])
      .addTo(m);
    return () => {
      marker.remove();
    };
  }, [location, satellite, radiusKm, interactive, loaded]);
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded || !m.getSource("sites")) return;
    (m.getSource("radius") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: radiusKm
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [circle(location.lng, location.lat, radiusKm)],
              },
            },
          ]
        : [],
    });
    (m.getSource("area") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features:
        polygon.length >= 3
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "Polygon",
                  coordinates: [[...polygon, polygon[0]]],
                },
              },
            ]
          : [],
    });
    (m.getSource("sites") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: sites.map((o) => ({
        type: "Feature",
        properties: {
          id: o.id,
          color: siteColor(o.status),
          selected: o.id === selectedSite,
        },
        geometry: { type: "Point", coordinates: [o.lng, o.lat] },
      })),
    });
  }, [loaded, location, radiusKm, polygon, sites, selectedSite]);
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
