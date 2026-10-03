import { BlurView } from "expo-blur";
import * as LocationService from "expo-location";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ChevronRight, MapPin, Navigation, X } from "lucide-react-native";
import NativeMap from "./components/NativeMap";
import PlaceSearch from "./components/PlaceSearch";
import { Button, Empty, Header } from "./components/Primitives";
import { coordinates } from "./services/api";
import { exportReport } from "./services/reportExport";
import { formatDate, reportHtml } from "./services/reportHtml";
import { useWorkspace } from "./state/Workspace";
import { colors, distance, ratingColor, siteColor, ui } from "./theme";
import type { Analysis, Assessment, Occurrence } from "./types";

const RADII = [10, 25, 50];
const LEGEND = [
  ["Producer", "Producer"],
  ["Past producer", "Past Producer"],
  ["Prospect", "Prospect"],
  ["Occurrence", "Occurrence"],
];
const openRecord = (o: Occurrence) => {
  if (o.url?.startsWith("https://")) void Linking.openURL(o.url);
};
const best = (a: Analysis) =>
  a.assessments.find((m) => m.prospectivity !== "Insufficient evidence");

export function RatingPill({ rating }: { rating?: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: ratingColor(rating) + "1F",
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: ratingColor(rating),
        }}
      />
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: ratingColor(rating),
        }}
      >
        {rating === "Insufficient evidence" ? "Not enough data" : rating}
      </Text>
    </View>
  );
}

function SiteRow({
  o,
  selected,
  onPress,
}: {
  o: Occurrence;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        ui.row,
        {
          paddingVertical: 13,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: selected ? colors.pale : "#fff",
          borderWidth: 1,
          borderColor: selected ? "#BFD8C6" : colors.line,
        },
      ]}
    >
      <View
        style={{
          width: 11,
          height: 11,
          borderRadius: 6,
          backgroundColor: siteColor(o.status),
        }}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={ui.h3} numberOfLines={1}>
          {o.name}
        </Text>
        <Text style={ui.small} numberOfLines={1}>
          {[o.status, o.commodities.join(", ")].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Text style={[ui.small, { color: colors.ink, fontWeight: "600" }]}>
        {distance(o.distance_m)}
      </Text>
      <ChevronRight size={16} color={colors.muted} />
    </Pressable>
  );
}

function Legend() {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {LEGEND.map(([label, status]) => (
        <View key={label} style={[ui.row, { gap: 5 }]}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: siteColor(status),
            }}
          />
          <Text style={ui.small}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export function Explore({
  analyze,
  save,
  results,
}: {
  analyze: () => void;
  save: () => void;
  results: () => void;
}) {
  const w = useWorkspace();
  const [satellite, setSatellite] = useState(true),
    [drawing, setDrawing] = useState(false),
    [error, setError] = useState(""),
    [site, setSite] = useState<Occurrence | null>(null);
  const a = w.analysis;
  const top = a && best(a);
  async function locate() {
    setError("");
    try {
      const permission =
        await LocationService.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Location permission is off. You can still search or tap the map.",
        );
      const p = await LocationService.getCurrentPositionAsync({
        accuracy: LocationService.Accuracy.Balanced,
      });
      setSite(null);
      w.selectLocation({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        name: "Current location",
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      <View style={StyleSheet.absoluteFill}>
        <NativeMap
          location={w.location}
          satellite={satellite}
          polygon={w.polygon}
          drawing={drawing}
          radiusKm={a?.radius_km ?? w.radius}
          sites={a?.occurrences}
          selectedSite={site?.id}
          onSite={setSite}
          onSelect={(p) => {
            setSite(null);
            if (drawing) w.setPolygon([...w.polygon, [p.lng, p.lat]]);
            else w.selectLocation(p);
          }}
        />
      </View>
      <View style={s.top}>
        <Text style={s.title}>Explore</Text>
        <PlaceSearch
          dark
          onSelect={(p) => {
            setSite(null);
            w.selectLocation(p);
          }}
        />
        <View style={s.segment}>
          <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
          {["Satellite", "Street", "Draw area"].map((label, i) => {
            const on = i === 2 ? drawing : satellite === (i === 0);
            return (
              <Pressable
                accessibilityRole="button"
                key={label}
                onPress={() =>
                  i === 2 ? setDrawing(!drawing) : setSatellite(i === 0)
                }
                style={[s.segmentItem, on && { backgroundColor: colors.green }]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: on ? "#fff" : "#486050",
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use current location"
        onPress={locate}
        style={s.gps}
      >
        <Navigation size={21} color={colors.green} />
      </Pressable>
      {drawing && (
        <View style={s.drawing}>
          <Text style={ui.small}>
            Tap at least 3 corners / {w.polygon.length} selected
          </Text>
          <Pressable onPress={() => w.setPolygon([])}>
            <Text style={{ fontSize: 12, color: colors.green, marginTop: 8 }}>
              Clear area
            </Text>
          </Pressable>
        </View>
      )}
      <View style={s.sheet}>
        <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
        <View style={s.grabber} />
        {site ? (
          <>
            <View style={ui.between}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={ui.h3} numberOfLines={2}>
                  {site.name}
                </Text>
                <View style={[ui.row, { gap: 6 }]}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: siteColor(site.status),
                    }}
                  />
                  <Text style={ui.small}>
                    {site.status} · {distance(site.distance_m)} away
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close site"
                hitSlop={10}
                onPress={() => setSite(null)}
              >
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>
            {!!site.commodities.length && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {site.commodities.map((c) => (
                  <Text key={c} style={ui.badge}>
                    {c}
                  </Text>
                ))}
              </View>
            )}
            <Button title="Open Record" onPress={() => openRecord(site)} />
          </>
        ) : (
          <>
            <View style={ui.row}>
              <View style={s.pin}>
                <MapPin size={22} color={colors.green} />
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={ui.h3} numberOfLines={2}>
                  {w.location.name}
                </Text>
                <Text style={ui.small}>{coordinates(w.location)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save location"
                onPress={save}
                hitSlop={10}
              >
                <Text style={{ fontSize: 12, color: colors.green }}>Save</Text>
              </Pressable>
            </View>
            {!!error && <Text style={ui.error}>{error}</Text>}
            {a ? (
              <Pressable
                accessibilityRole="button"
                onPress={results}
                style={[ui.between, s.result]}
              >
                <View style={{ gap: 6, flex: 1 }}>
                  <RatingPill rating={top?.prospectivity ?? a.rating} />
                  <Text style={ui.h3}>
                    {top ? top.commodity : "No clear signal"}
                    <Text style={[ui.small, { fontWeight: "400" }]}>
                      {"  "}
                      {a.occurrences.length} sites · {a.radius_km} km
                    </Text>
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.green} />
              </Pressable>
            ) : (
              <>
                <View style={[ui.row, { gap: 6 }]}>
                  {RADII.map((r) => (
                    <Pressable
                      key={r}
                      accessibilityRole="button"
                      accessibilityLabel={`${r} km radius`}
                      onPress={() => w.setRadius(r)}
                      style={[
                        s.chip,
                        w.radius === r && {
                          backgroundColor: colors.green,
                          borderColor: colors.green,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: w.radius === r ? "#fff" : colors.ink,
                        }}
                      >
                        {r} km
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Button
                  title="Analyze Location"
                  busy={w.status === "queued" || w.status === "processing"}
                  onPress={analyze}
                />
              </>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function MineralRow({
  m,
  guide,
}: {
  m: Assessment;
  guide: (q: string) => void;
}) {
  return (
    <View style={[ui.card, { gap: 10 }]}>
      <View style={ui.between}>
        <Text style={ui.h3}>{m.commodity}</Text>
        <RatingPill rating={m.prospectivity} />
      </View>
      <Text style={ui.body}>{m.explanation}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => guide(m.commodity)}
        hitSlop={8}
      >
        <Text style={{ color: colors.green, fontSize: 12, fontWeight: "600" }}>
          About {m.commodity}
        </Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[ui.h2, { fontSize: 22 }]}>{value}</Text>
      <Text style={ui.small}>{label}</Text>
    </View>
  );
}

export function AnalysisScreen({
  back,
  save,
  report,
  guide,
}: {
  back: () => void;
  save: () => void;
  report: () => void;
  guide: (query?: string) => void;
}) {
  const w = useWorkspace();
  const [tab, setTab] = useState("Minerals"),
    [site, setSite] = useState<string>(),
    [showAll, setShowAll] = useState(false);
  const a = w.analysis;
  const top = a && best(a);
  const rated = a?.assessments.filter(
    (m) => m.prospectivity !== "Insufficient evidence",
  );
  const minerals = showAll ? a?.assessments : rated;
  const producers = a?.occurrences.filter((o) =>
    o.status.toLowerCase().includes("producer"),
  ).length;
  return (
    <>
      <Header title="Location Analysis" back={back} />
      <ScrollView contentContainerStyle={ui.content}>
        <View style={s.preview}>
          <NativeMap
            location={w.location}
            satellite
            polygon={w.polygon}
            drawing={false}
            interactive={false}
            radiusKm={a?.radius_km ?? w.radius}
            sites={a?.occurrences}
            selectedSite={site}
            onSite={(o) => {
              setSite(o.id);
              setTab("Sites");
            }}
            onSelect={() => {}}
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={ui.h2}>{w.location.name}</Text>
          <Text style={ui.small}>{coordinates(w.location)}</Text>
        </View>
        {!a && !w.error ? (
          <View style={[ui.card, { paddingVertical: 40, alignItems: "center" }]}>
            <ActivityIndicator color={colors.green} />
            <Text style={ui.h3}>
              {w.status === "queued" ? "Queued" : "Checking maps and mine records"}
            </Text>
          </View>
        ) : w.error ? (
          <Empty title="Analysis unavailable" description={w.error}>
            <Button title="Try Again" onPress={() => void w.analyze()} />
          </Empty>
        ) : (
          a && (
            <>
              <View style={[ui.card, { gap: 16 }]}>
                <View style={{ gap: 8 }}>
                  <RatingPill rating={top?.prospectivity ?? a.rating} />
                  <Text style={[ui.title, { fontSize: 28, lineHeight: 33 }]}>
                    {top ? top.commodity : "No clear signal"}
                  </Text>
                </View>
                <View style={ui.divider} />
                <View style={ui.row}>
                  <Stat label="Sites" value={a.occurrences.length} />
                  <Stat label="Producers" value={producers ?? 0} />
                  <Stat label="Radius" value={`${a.radius_km} km`} />
                </View>
              </View>
              <View style={s.tabs}>
                {["Minerals", "Sites", "Geology", "Sources"].map((t) => (
                  <Pressable
                    key={t}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === t }}
                    onPress={() => setTab(t)}
                    style={[s.tab, tab === t && s.tabOn]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: tab === t ? colors.ink : colors.muted,
                      }}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {tab === "Minerals" ? (
                <>
                  {!minerals?.length && (
                    <Empty title="No clear signal" description="" />
                  )}
                  {minerals?.map((m) => (
                    <MineralRow key={m.commodity} m={m} guide={guide} />
                  ))}
                  {!!a.assessments.length &&
                    a.assessments.length !== rated?.length && (
                      <Pressable onPress={() => setShowAll(!showAll)}>
                        <Text
                          style={{
                            color: colors.green,
                            fontSize: 12,
                            fontWeight: "600",
                            textAlign: "center",
                          }}
                        >
                          {showAll ? "Show fewer" : "Show all"}
                        </Text>
                      </Pressable>
                    )}
                </>
              ) : tab === "Sites" ? (
                <>
                  {a.occurrences.length ? (
                    <>
                      <Legend />
                      {a.occurrences.map((o) => (
                        <SiteRow
                          key={o.id}
                          o={o}
                          selected={o.id === site}
                          onPress={() => {
                            setSite(o.id);
                            openRecord(o);
                          }}
                        />
                      ))}
                    </>
                  ) : (
                    <Empty
                      title="No recorded sites"
                      description={`Within ${a.radius_km} km`}
                    />
                  )}
                </>
              ) : tab === "Geology" ? (
                <>
                  {!a.geology_units?.length && (
                    <Empty title="No mapped geology" description="" />
                  )}
                  {a.geology_units?.map((u, i) => (
                    <View key={i} style={[ui.card, { flexDirection: "row" }]}>
                      <View
                        style={{
                          width: 6,
                          borderRadius: 3,
                          backgroundColor: u.color || colors.line,
                        }}
                      />
                      <View style={{ flex: 1, gap: 5 }}>
                        <Text style={ui.h3}>{u.name}</Text>
                        {!!u.lith && <Text style={ui.body}>{u.lith}</Text>}
                        {!!u.age && <Text style={ui.small}>{u.age}</Text>}
                        {w.professional && !!u.reference && (
                          <Text style={ui.small}>{u.reference}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <>
                  {a.providers.map((p) => (
                    <Pressable
                      key={p.source.id}
                      accessibilityRole="link"
                      onPress={() => {
                        if (p.source.source_url.startsWith("https://"))
                          void Linking.openURL(p.source.source_url);
                      }}
                      style={[ui.card, ui.between]}
                    >
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={ui.h3}>{p.source.dataset_name}</Text>
                        <Text style={ui.small}>
                          {p.source.provider_name} · {p.status}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.muted} />
                    </Pressable>
                  ))}
                  <Text style={ui.h3}>Next steps</Text>
                  {a.next_steps.map((n, i) => (
                    <View key={i} style={[ui.row, { alignItems: "flex-start" }]}>
                      <Text style={[ui.small, { width: 18, fontWeight: "700" }]}>
                        {i + 1}
                      </Text>
                      <Text style={[ui.body, { flex: 1 }]}>{n}</Text>
                    </View>
                  ))}
                  <Text style={ui.h3}>Limits</Text>
                  {a.limitations.map((n, i) => (
                    <Text key={i} style={ui.small}>
                      {n}
                    </Text>
                  ))}
                </>
              )}
              <Button title="View Report" onPress={report} />
              <Button outline title="Save to My Projects" onPress={save} />
            </>
          )
        )}
      </ScrollView>
    </>
  );
}

export function ReportScreen({ back }: { back: () => void }) {
  const w = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const a = w.analysis;
  const top = a && best(a);
  async function download() {
    if (!a) return;
    setBusy(true);
    setError("");
    try {
      await exportReport(a, reportHtml(a, coordinates(a.location)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header title="Report" back={back} />
      <ScrollView contentContainerStyle={ui.content}>
        {a ? (
          <>
            <View style={s.cover}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                Geo<Text style={{ color: colors.gold }}>Mineral</Text>
              </Text>
              <Text style={[ui.title, { color: "#fff", marginTop: 22 }]}>
                {a.location.name}
              </Text>
              <Text style={{ color: "#B9CCC2", fontSize: 11 }}>
                {coordinates(a.location)} · {a.radius_km} km ·{" "}
                {formatDate(a.created_at)}
              </Text>
            </View>
            <View style={[ui.card, { gap: 10 }]}>
              <RatingPill rating={top?.prospectivity ?? a.rating} />
              <Text style={ui.h2}>{top ? top.commodity : "No clear signal"}</Text>
              <View style={ui.row}>
                <Stat label="Sites" value={a.occurrences.length} />
                <Stat
                  label="Minerals"
                  value={
                    a.assessments.filter(
                      (m) => m.prospectivity !== "Insufficient evidence",
                    ).length
                  }
                />
                <Stat label="Rock units" value={a.geology_units?.length ?? 0} />
              </View>
            </View>
            <View style={[ui.card, { gap: 12 }]}>
              {[
                "Site map",
                "Mineral ratings",
                "Recorded sites",
                "Geology",
                "Next steps",
                "Sources",
              ].map((t) => (
                <View key={t} style={ui.row}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: colors.green,
                    }}
                  />
                  <Text style={[ui.body, { color: colors.ink }]}>{t}</Text>
                </View>
              ))}
            </View>
            <Button title="Export PDF" busy={busy} onPress={download} />
            {!!error && <Text style={ui.error}>{error}</Text>}
          </>
        ) : (
          <Empty
            title="No report yet"
            description="Analyze a location to create a report."
          />
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  cover: {
    backgroundColor: "#0B231C",
    borderRadius: 24,
    padding: 24,
    gap: 6,
  },
  top: { position: "absolute", top: 0, left: 0, right: 0, padding: 20, gap: 13 },
  title: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.8,
    color: "#fff",
    textShadowColor: "#0008",
    textShadowRadius: 10,
    paddingHorizontal: 5,
    paddingTop: 5,
  },
  segment: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: 5,
    gap: 4,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#F3F5EBE8",
  },
  segmentItem: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22 },
  gps: {
    position: "absolute",
    right: 21,
    top: 225,
    width: 48,
    height: 48,
    borderRadius: 25,
    backgroundColor: "#F8FBF0EC",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 18px #0002",
  },
  drawing: {
    position: "absolute",
    left: 21,
    right: 82,
    top: 225,
    padding: 15,
    borderRadius: 20,
    backgroundColor: "#F8FBF0EC",
  },
  sheet: {
    position: "absolute",
    left: 15,
    right: 15,
    bottom: 98,
    padding: 21,
    gap: 14,
    borderRadius: 29,
    overflow: "hidden",
    backgroundColor: "#F6F9EFEF",
    borderWidth: 1,
    borderColor: "#FFFFFF99",
    boxShadow: "0px 10px 35px #0003",
  },
  grabber: {
    width: 32,
    height: 4,
    backgroundColor: "#CBD2C8",
    borderRadius: 3,
    alignSelf: "center",
    marginTop: -10,
  },
  pin: { backgroundColor: "#DFE9D7", padding: 12, borderRadius: 18 },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D5DDD3",
  },
  result: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.line,
  },
  preview: {
    height: 220,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.dark,
  },
  tabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 16,
    backgroundColor: "#E6EBE3",
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12 },
  tabOn: { backgroundColor: "#fff", boxShadow: "0px 2px 8px #0000000F" },
});
