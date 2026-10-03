"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import {
  Layers,
  LocateFixed,
  Pentagon,
  Undo2,
  Check,
  X,
  MapPin,
} from "lucide-react";
import type { Location, Occurrence } from "@/lib/types";

export default function GeoMap({
  location,
  select,
  polygon,
  onPolygon,
  occurrences = [],
  expanded = false,
}: {
  location: Location;
  select: (l: Location) => void;
  polygon: number[][];
  onPolygon: (p: number[][]) => void;
  occurrences?: Occurrence[];
  expanded?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    marker = useRef<maplibregl.Marker | null>(null);
  const selectRef = useRef(select),
    polygonRef = useRef(polygon),
    onPolygonRef = useRef(onPolygon),
    drawingRef = useRef(false);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [layers, setLayers] = useState(false),
    [base, setBase] = useState("satellite"),
    [drawing, setDrawing] = useState(false),
    [showOccurrences, setShowOccurrences] = useState(true);
  selectRef.current = select;
  polygonRef.current = polygon;
  onPolygonRef.current = onPolygon;
  drawingRef.current = drawing;
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        center: [location.lng, location.lat],
        zoom: 7,
        maxZoom: 18,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: "raster",
              tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              ],
              tileSize: 256,
              attribution:
                "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
            },
            street: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
              maxzoom: 19,
            },
          },
          layers: [
            {
              id: "satellite",
              type: "raster",
              source: "satellite",
              paint: {
                "raster-saturation": -0.45,
                "raster-brightness-max": 0.8,
              },
            },
            {
              id: "street",
              type: "raster",
              source: "street",
              layout: { visibility: "none" },
            },
          ],
        },
      });
    } catch {
      setError(
        "Interactive maps require WebGL. Place and coordinate search are still available.",
      );
      return;
    }
    map.current = instance;
    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "bottom-right",
    );
    instance.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );
    marker.current = new maplibregl.Marker({ color: "#d5b86b" })
      .setLngLat([location.lng, location.lat])
      .addTo(instance);
    instance.on("load", () => {
      instance.addSource("area", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      instance.addLayer({
        id: "area-fill",
        type: "fill",
        source: "area",
        filter: ["==", "$type", "Polygon"],
        paint: { "fill-color": "#70cea3", "fill-opacity": 0.2 },
      });
      instance.addLayer({
        id: "area-line",
        type: "line",
        source: "area",
        paint: { "line-color": "#a5e5bf", "line-width": 2.5 },
      });
      instance.addSource("occurrences", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      instance.addLayer({
        id: "occurrences",
        type: "circle",
        source: "occurrences",
        paint: {
          "circle-radius": 5,
          "circle-color": "#e5c681",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      });
      instance.on("click", "occurrences", (e) => {
        const f = e.features?.[0];
        if (f && f.geometry.type === "Point")
          new maplibregl.Popup()
            .setLngLat(f.geometry.coordinates as [number, number])
            .setText(`${f.properties?.name} · Reported occurrence`)
            .addTo(instance);
      });
      setReady(true);
    });
    instance.on("error", () =>
      setError(
        "Some map tiles could not load. Check your connection or switch basemap.",
      ),
    );
    instance.on("click", (e) => {
      if (drawingRef.current)
        onPolygonRef.current([
          ...polygonRef.current,
          [e.lngLat.lng, e.lngLat.lat],
        ]);
      else
        selectRef.current({
          lat: e.lngLat.lat,
          lng: e.lngLat.wrap().lng,
          name: "Dropped pin",
        });
    });
    return () => {
      instance.remove();
      map.current = null;
    };
    // The map instance is initialized once; state is synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    marker.current?.setLngLat([location.lng, location.lat]);
    map.current?.flyTo({
      center: [location.lng, location.lat],
      zoom: Math.max(map.current.getZoom(), 7),
      duration: 1100,
    });
  }, [location]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const geometry =
      polygon.length >= 3
        ? { type: "Polygon" as const, coordinates: [[...polygon, polygon[0]]] }
        : { type: "LineString" as const, coordinates: polygon };
    (map.current.getSource("area") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features:
        polygon.length > 1
          ? [{ type: "Feature", properties: {}, geometry }]
          : [],
    });
  }, [polygon, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("occurrences") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: occurrences.map((o) => ({
        type: "Feature",
        properties: { name: o.name },
        geometry: { type: "Point", coordinates: [o.lng, o.lat] },
      })),
    });
  }, [occurrences, ready]);
  useEffect(() => {
    if (ready) {
      map.current?.setLayoutProperty(
        "satellite",
        "visibility",
        base === "satellite" ? "visible" : "none",
      );
      map.current?.setLayoutProperty(
        "street",
        "visibility",
        base === "street" ? "visible" : "none",
      );
      map.current?.setLayoutProperty(
        "occurrences",
        "visibility",
        showOccurrences ? "visible" : "none",
      );
    }
  }, [base, ready, showOccurrences]);
  async function locate() {
    if (!navigator.geolocation) {
      setError("Location access is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        select({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          name: "Current location",
        }),
      () =>
        setError(
          "Location access was unavailable. Search a place or drop a pin.",
        ),
    );
  }
  return (
    <div className={`geo-map ${expanded ? "expanded" : ""}`}>
      <div
        ref={container}
        className="map-canvas"
        aria-label="Interactive global map"
      />
      <div className="map-topline">
        <span className="map-label">
          <span className="live-dot" /> GLOBAL EXPLORER
        </span>
        <span className="map-label soft">
          {base === "satellite" ? "Satellite imagery" : "Street map"}
        </span>
      </div>
      <div className="map-tools">
        <button aria-label="Map layers" onClick={() => setLayers(!layers)}>
          <Layers size={18} />
        </button>
        <button aria-label="Use current location" onClick={locate}>
          <LocateFixed size={18} />
        </button>
        <button
          aria-label="Draw project area"
          className={drawing ? "active" : ""}
          onClick={() => {
            setDrawing(!drawing);
            if (!drawing) onPolygon([]);
          }}
        >
          <Pentagon size={18} />
        </button>
      </div>
      {layers && (
        <div className="layer-panel">
          <h3>Map layers</h3>
          {["satellite", "street"].map((b) => (
            <label key={b}>
              <input
                type="radio"
                name="basemap"
                checked={base === b}
                onChange={() => {
                  setBase(b);
                  setError("");
                }}
              />
              {b === "satellite" ? "Satellite" : "Street"}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={showOccurrences}
              onChange={(e) => setShowOccurrences(e.target.checked)}
            />
            Reported occurrences ({occurrences.length})
          </label>
          <div className="disabled-layer">
            Geology, faults & geophysics
            <small>
              Map overlays are not connected. Geological descriptions appear in
              your analysis.
            </small>
          </div>
        </div>
      )}
      {drawing && (
        <div className="draw-instruction">
          <Pentagon size={16} />
          <span>
            Click to outline a project area · {polygon.length} vertices
          </span>
          <button
            aria-label="Undo last vertex"
            onClick={() => onPolygon(polygon.slice(0, -1))}
          >
            <Undo2 size={16} />
          </button>
          <button
            aria-label="Finish polygon"
            disabled={polygon.length < 3}
            onClick={() => setDrawing(false)}
          >
            <Check size={16} />
          </button>
          <button
            aria-label="Cancel polygon"
            onClick={() => {
              onPolygon([]);
              setDrawing(false);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <div className="map-error" role="status">
          {error}
          <button aria-label="Dismiss map notice" onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="map-hint">
        <MapPin size={14} /> Click anywhere to drop a pin
      </div>
    </div>
  );
}
