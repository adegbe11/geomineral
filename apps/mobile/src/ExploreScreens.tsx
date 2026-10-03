import { BlurView } from "expo-blur";
import * as LocationService from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Check,
  ChevronRight,
  FileText,
  Layers,
  Minus,
  LocateFixed,
  MapPin,
  PenLine,
  X,
} from "lucide-react-native";
import DeepTime from "./components/DeepTime";
import LandStatus from "./components/LandStatus";
import NativeMap from "./components/NativeMap";
import PlaceSearch from "./components/PlaceSearch";
import { Button, Empty, Header, Row } from "./components/Primitives";
import {
  CountUp,
  FadeIn,
  haptic,
  Pressy,
  Segmented,
  Shimmer,
  useReduceMotion,
} from "./motion";
import { coordinates } from "./services/api";
import { exportReport } from "./services/reportExport";
import { formatDate, reportHtml } from "./services/reportHtml";
import { useWorkspace } from "./state/Workspace";
import {
  distance,
  ratingColor,
  ratingLabel,
  siteColor,
  type,
  useTheme,
} from "./theme";
import type { Analysis, Assessment, Location, Occurrence } from "./types";

const native = Platform.OS !== "web";
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
  const color = ratingColor(rating);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: color + "24",
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ ...type.caption, fontWeight: "700", color }}>{ratingLabel(rating)}</Text>
    </View>
  );
}

function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
    />
  );
}

function Legend() {
  const { ui } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, paddingHorizontal: 4 }}>
      {LEGEND.map(([label, status]) => (
        <View key={label} style={[ui.row, { gap: 6 }]}>
          <Dot color={siteColor(status)} size={8} />
          <Text style={ui.caption}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Glass circle button that floats over the map. */
function GlassButton({
  label,
  onPress,
  active,
  children,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? c.tint : c.glass,
        borderWidth: 0.5,
        borderColor: c.glassBorder,
        boxShadow: "0px 6px 18px rgba(0,0,0,0.16)",
      }}
    >
      {children}
    </Pressy>
  );
}

export function Explore({
  analyze,
  save,
  results,
}: {
  analyze: (place: Location) => void;
  save: () => void;
  results: () => void;
}) {
  const w = useWorkspace();
  const { c, ui, dark } = useTheme();
  const still = useReduceMotion();
  const [satellite, setSatellite] = useState(true),
    [drawing, setDrawing] = useState(false),
    [error, setError] = useState(""),
    [site, setSite] = useState<Occurrence | null>(null),
    [showGeology, setShowGeology] = useState(true);
  const a = w.analysis;
  const top = a && best(a);
  const rise = useRef(new Animated.Value(still ? 0 : 260)).current;
  useEffect(() => {
    Animated.spring(rise, {
      toValue: 0,
      speed: 12,
      bounciness: 6,
      useNativeDriver: native,
    }).start();
  }, []);
  async function locate() {
    setError("");
    try {
      const permission = await LocationService.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error("Location is off. You can still search or tap the map.");
      const p = await LocationService.getCurrentPositionAsync({
        accuracy: LocationService.Accuracy.Balanced,
      });
      setSite(null);
      w.selectLocation({ lat: p.coords.latitude, lng: p.coords.longitude, name: "Current location" });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const sheetKey = site ? `site-${site.id}` : a ? "result" : "place";
  return (
    <View style={{ flex: 1, backgroundColor: "#06150F" }}>
      <View style={StyleSheet.absoluteFill}>
        <NativeMap
          location={w.location}
          world={!w.hasPlace}
          satellite={satellite}
          polygon={w.polygon}
          drawing={drawing}
          radiusKm={w.hasPlace ? (a?.radius_km ?? w.radius) : undefined}
          sites={a?.occurrences}
          geology={showGeology ? a?.layers : undefined}
          selectedSite={site?.id}
          onSite={(o) => {
            haptic.select();
            setSite(o);
          }}
          onSelect={(p) => {
            setSite(null);
            if (drawing) {
              haptic.tap();
              w.setPolygon((old) => [...old, [p.lng, p.lat]]);
            } else w.selectLocation(p);
          }}
        />
      </View>
      <View style={s.top}>
        <PlaceSearch
          dark
          onSelect={(p) => {
            setSite(null);
            w.selectLocation(p);
          }}
        />
        <View style={[ui.row, { gap: 8 }]}>
          <View style={{ width: 180 }}>
            <Segmented
              glass
              items={["Satellite", "Street"]}
              value={satellite ? "Satellite" : "Street"}
              onChange={(v) => setSatellite(v === "Satellite")}
            />
          </View>
          <View style={{ flex: 1 }} />
          {!!a?.layers?.units?.length && (
            <GlassButton label="Geology layer" active={showGeology} onPress={() => setShowGeology(!showGeology)}>
              <Layers size={19} color={showGeology ? c.onTint : c.label} />
            </GlassButton>
          )}
          <GlassButton label="Draw area" active={drawing} onPress={() => setDrawing(!drawing)}>
            <PenLine size={19} color={drawing ? c.onTint : c.label} />
          </GlassButton>
          <GlassButton label="Use current location" onPress={locate}>
            <LocateFixed size={19} color={c.tint} />
          </GlassButton>
        </View>
        {drawing && (
          <FadeIn>
            <View style={[s.glassNote, { backgroundColor: c.glass, borderColor: c.glassBorder }]}>
              <Text style={[ui.small, { color: c.label, flex: 1 }]}>
                Tap corners · {w.polygon.length} placed
              </Text>
              {!!w.polygon.length && (
                <Pressable onPress={() => w.setPolygon([])} hitSlop={8}>
                  <Text style={{ ...type.footnote, fontWeight: "600", color: c.tint }}>Clear</Text>
                </Pressable>
              )}
            </View>
          </FadeIn>
        )}
      </View>
      <Animated.View
        style={[
          s.sheet,
          { borderColor: c.glassBorder, backgroundColor: c.glass, transform: [{ translateY: rise }] },
        ]}
      >
        <BlurView intensity={60} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={[s.grabber, { backgroundColor: c.tertiary }]} />
        <FadeIn key={sheetKey} style={{ gap: 14 }}>
          {site ? (
            <>
              <View style={ui.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={ui.h3} numberOfLines={2}>
                    {site.name}
                  </Text>
                  <View style={[ui.row, { gap: 6 }]}>
                    <Dot color={siteColor(site.status)} size={8} />
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
                  style={[s.close, { backgroundColor: c.fill }]}
                >
                  <X size={15} color={c.secondary} strokeWidth={2.6} />
                </Pressable>
              </View>
              {!!site.commodities.length && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {site.commodities.map((x) => (
                    <Text key={x} style={ui.badge}>
                      {x}
                    </Text>
                  ))}
                </View>
              )}
              <Button outline title="Open Record" onPress={() => openRecord(site)} />
            </>
          ) : (
            <>
              <View style={ui.row}>
                <View style={[s.pin, { backgroundColor: c.tintSoft }]}>
                  <MapPin size={20} color={c.tint} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={ui.h3} numberOfLines={2}>
                    {w.hasPlace ? w.location.name : "Drop a pin anywhere"}
                  </Text>
                  <Text style={ui.small}>
                    {w.hasPlace ? coordinates(w.location) : "Tap the map, search, or use your location"}
                  </Text>
                </View>
                {w.hasPlace && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Save location"
                    onPress={save}
                    hitSlop={10}
                  >
                    <Text style={{ ...type.subhead, fontWeight: "600", color: c.tint }}>Save</Text>
                  </Pressable>
                )}
              </View>
              {!!error && <Text style={ui.error}>{error}</Text>}
              {a ? (
                <Pressy
                  accessibilityRole="button"
                  onPress={results}
                  scaleTo={0.97}
                  style={[ui.between, s.result, { backgroundColor: c.card }]}
                >
                  <View style={{ gap: 6, flex: 1 }}>
                    <RatingPill rating={top?.prospectivity ?? a.rating} />
                    <Text style={ui.h2}>
                      {top ? top.commodity : "No clear signal"}
                      <Text style={[ui.small, { fontWeight: "400" }]}>
                        {"  "}
                        {a.occurrences.length} sites · {a.radius_km} km
                      </Text>
                    </Text>
                  </View>
                  <ChevronRight size={20} color={c.tertiary} />
                </Pressy>
              ) : (
                <>
                  <Segmented
                    items={RADII}
                    value={w.radius}
                    onChange={w.setRadius}
                    label={(r) => `${r} km`}
                    a11y={(r) => `${r} km radius`}
                  />
                  <Button
                    title="Analyze Location"
                    busy={w.status === "queued" || w.status === "processing"}
                    onPress={async () => {
                      setError("");
                      try {
                        analyze(await w.ensurePlace());
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  />
                </>
              )}
            </>
          )}
        </FadeIn>
      </Animated.View>
    </View>
  );
}

function MineralRow({ m, guide }: { m: Assessment; guide: (q: string) => void }) {
  const { c, ui } = useTheme();
  return (
    <View style={[ui.card, { gap: 8, flexDirection: "row" }]}>
      <View style={{ width: 4, borderRadius: 2, backgroundColor: ratingColor(m.prospectivity) }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={ui.between}>
          <Text style={ui.h3}>{m.commodity}</Text>
          <RatingPill rating={m.prospectivity} />
        </View>
        <Text style={ui.body}>{m.explanation}</Text>
        {!!m.papers?.length && (
          <View style={{ gap: 6, marginTop: 2 }}>
            <Text style={ui.caption}>Research</Text>
            {m.papers.slice(0, 3).map((p) => (
              <Pressable
                key={p.url}
                accessibilityRole="link"
                accessibilityLabel={`Open paper: ${p.title}`}
                onPress={() => {
                  if (p.url.startsWith("https://")) void Linking.openURL(p.url);
                }}
                style={({ pressed }) => [
                  ui.row,
                  { gap: 8, alignItems: "flex-start", padding: 10, borderRadius: 12, backgroundColor: pressed ? c.fillStrong : c.fill },
                ]}
              >
                <Text style={[ui.badge, !p.studied && { color: c.secondary, backgroundColor: c.fillStrong }]}>
                  {p.studied ? "Study" : "Mention"}
                </Text>
                <Text style={[ui.small, { flex: 1, color: c.label }]} numberOfLines={2}>
                  {p.title}
                  {p.year ? <Text style={ui.small}>{` · ${p.year}`}</Text> : null}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => guide(m.commodity)}
          hitSlop={8}
          style={{ alignSelf: "flex-start" }}
        >
          <Text style={{ ...type.subhead, fontWeight: "600", color: c.tint }}>
            About {m.commodity}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  const { ui } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={ui.title}>
        <CountUp value={value} style={ui.title} />
        {suffix}
      </Text>
      <Text style={ui.small}>{label}</Text>
    </View>
  );
}

// Each stage is a real evidence source the worker reports as it finishes.
const STAGES = [
  ["macrostrat", "Geological map"],
  ["usgs-mrds", "Mine and mineral records"],
  ["openalex", "Published research"],
  ["macrostrat-structure", "Faults and structure"],
] as const;
const STAGE_NOTE: Record<string, string> = {
  empty: "Nothing recorded here",
  unavailable: "Unavailable right now",
  disabled: "Switched off",
};

function StageRow({ label, state, waiting }: { label: string; state?: string; waiting?: boolean }) {
  const { c, ui } = useTheme();
  const pop = useRef(new Animated.Value(state ? 1 : 0)).current;
  useEffect(() => {
    if (!state) return;
    haptic.select();
    Animated.spring(pop, { toValue: 1, speed: 14, bounciness: 12, useNativeDriver: native }).start();
  }, [state]);
  const done = state === "available" || state === "empty";
  return (
    <View style={[ui.row, { gap: 12, paddingVertical: 8 }]} accessibilityLabel={`${label}: ${state ?? "working"}`}>
      <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
        {waiting ? (
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.fillStrong }} />
        ) : !state ? (
          <ActivityIndicator color={c.tint} />
        ) : (
          <Animated.View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: done ? c.tint : c.fillStrong,
              transform: [{ scale: pop }],
            }}
          >
            {done ? <Check size={14} color={c.onTint} strokeWidth={3.2} /> : <Minus size={14} color={c.secondary} strokeWidth={3} />}
          </Animated.View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ui.text, !state && { color: c.secondary }]}>{label}</Text>
        {!!state && STAGE_NOTE[state] && <Text style={ui.caption}>{STAGE_NOTE[state]}</Text>}
      </View>
    </View>
  );
}

function Loading({ place, progress }: { place: string; progress: Record<string, string> }) {
  const { ui } = useTheme();
  const finished = STAGES.filter(([key]) => progress[key]).length;
  return (
    <View style={{ gap: 16 }}>
      <FadeIn>
        <View style={[ui.card, { gap: 4, padding: 20 }]}>
          <Text style={ui.caption}>Analyzing</Text>
          <Text style={ui.h2} numberOfLines={2}>
            {place}
          </Text>
          <View style={[ui.divider, { marginVertical: 10 }]} />
          {STAGES.map(([key, label]) => (
            <StageRow key={key} label={label} state={progress[key]} />
          ))}
          <StageRow label="Prospectivity model" waiting={finished < STAGES.length} />
        </View>
      </FadeIn>
      <Shimmer style={{ height: 96, borderRadius: 22 }} />
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
  const { c, ui } = useTheme();
  const [tab, setTab] = useState("Minerals"),
    [site, setSite] = useState<string>(),
    [showAll, setShowAll] = useState(false);
  const a = w.analysis;
  const top = a && best(a);
  const rated = a?.assessments.filter((m) => m.prospectivity !== "Insufficient evidence");
  const minerals = showAll ? a?.assessments : rated;
  const producers =
    a?.occurrences.filter((o) => o.status.toLowerCase().includes("producer")).length ?? 0;
  useEffect(() => {
    if (a) haptic.success();
  }, [a?.evidence_fingerprint]);
  return (
    <View style={ui.page}>
      <Header title="Analysis" back={back} />
      <ScrollView contentContainerStyle={ui.content}>
        <View style={[s.preview, { backgroundColor: c.hero }]}>
          <NativeMap
            location={w.location}
            satellite
            polygon={w.polygon}
            drawing={false}
            interactive={false}
            radiusKm={a?.radius_km ?? w.radius}
            sites={a?.occurrences}
            geology={a?.layers}
            selectedSite={site}
            onSite={(o) => {
              haptic.select();
              setSite(o.id);
              setTab("Sites");
            }}
            onSelect={() => {}}
          />
        </View>
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <Text style={ui.h2}>{w.location.name}</Text>
          <Text style={ui.small}>{coordinates(w.location)}</Text>
        </View>
        {!a && !w.error ? (
          <Loading place={w.location.name || "This place"} progress={w.progress} />
        ) : w.error ? (
          <Empty title="Analysis unavailable" description={w.error}>
            <Button title="Try Again" onPress={() => void w.analyze()} />
          </Empty>
        ) : (
          a && (
            <>
              <FadeIn>
                <View style={[ui.card, { gap: 16, padding: 20 }]}>
                  <View style={{ gap: 8 }}>
                    <RatingPill rating={top?.prospectivity ?? a.rating} />
                    <Text style={ui.largeTitle}>{top ? top.commodity : "No clear signal"}</Text>
                  </View>
                  <View style={ui.divider} />
                  <View style={ui.row}>
                    <Stat label="Sites" value={a.occurrences.length} />
                    <Stat label="Producers" value={producers} />
                    <Stat label="Faults" value={a.structure?.count ?? 0} />
                  </View>
                </View>
              </FadeIn>
              <LandStatus location={a.location} />
              <FadeIn delay={120}>
                <Segmented
                  role="tab"
                  items={["Minerals", "Sites", "Geology", "Time", "Sources"]}
                  value={tab}
                  onChange={setTab}
                />
              </FadeIn>
              <View key={tab} style={{ gap: 12 }}>
                {tab === "Minerals" ? (
                  <>
                    {!minerals?.length && <Empty title="No clear signal" description="" />}
                    {minerals?.map((m, i) => (
                      <FadeIn key={m.commodity} index={i}>
                        <MineralRow m={m} guide={guide} />
                      </FadeIn>
                    ))}
                    {!!a.assessments.length && a.assessments.length !== rated?.length && (
                      <Button
                        plain
                        title={showAll ? "Show Fewer" : "Show All"}
                        onPress={() => setShowAll(!showAll)}
                      />
                    )}
                  </>
                ) : tab === "Sites" ? (
                  a.occurrences.length ? (
                    <>
                      <Legend />
                      <View style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
                        {a.occurrences.map((o, i) => (
                          <FadeIn key={o.id} index={i}>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                setSite(o.id);
                                openRecord(o);
                              }}
                              style={({ pressed }) => [
                                ui.row,
                                {
                                  gap: 12,
                                  paddingLeft: 16,
                                  backgroundColor:
                                    pressed || o.id === site ? c.fill : "transparent",
                                },
                              ]}
                            >
                              <Dot color={siteColor(o.status)} />
                              <View
                                style={[
                                  ui.row,
                                  {
                                    flex: 1,
                                    paddingVertical: 11,
                                    paddingRight: 16,
                                    borderBottomWidth: i === a.occurrences.length - 1 ? 0 : 0.5,
                                    borderColor: c.separator,
                                  },
                                ]}
                              >
                                <View style={{ flex: 1, gap: 1 }}>
                                  <Text style={ui.h3} numberOfLines={1}>
                                    {o.name}
                                  </Text>
                                  <Text style={ui.small} numberOfLines={1}>
                                    {[o.status, o.commodities.join(", ")].filter(Boolean).join(" · ")}
                                  </Text>
                                </View>
                                <Text style={[ui.small, { color: c.label }]}>
                                  {distance(o.distance_m)}
                                </Text>
                              </View>
                            </Pressable>
                          </FadeIn>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Empty title="No recorded sites" description={`Within ${a.radius_km} km`} />
                  )
                ) : tab === "Time" ? (
                  <DeepTime location={a.location} units={a.geology_units} />
                ) : tab === "Geology" ? (
                  <>
                    <View style={[ui.card, ui.row, { gap: 12 }]}>
                      <View style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: "#FF5A4E" }} />
                      <Text style={[ui.text, { flex: 1 }]}>
                        {a.structure?.count
                          ? `Nearest fault ${a.structure.nearest_km?.toFixed(1)} km · ${a.structure.count} mapped`
                          : `No mapped faults within ${a.radius_km} km`}
                      </Text>
                    </View>
                    {!a.geology_units?.length && <Empty title="No mapped geology" description="" />}
                    {a.geology_units?.map((u, i) => (
                      <FadeIn key={i} index={i}>
                        <View style={[ui.card, { flexDirection: "row" }]}>
                          <View
                            style={{ width: 6, borderRadius: 3, backgroundColor: u.color || c.fill }}
                          />
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={ui.h3}>{u.name}</Text>
                            {!!u.lith && <Text style={ui.body}>{u.lith}</Text>}
                            {!!u.age && <Text style={ui.small}>{u.age}</Text>}
                            {w.professional && !!u.reference && (
                              <Text style={ui.caption}>{u.reference}</Text>
                            )}
                          </View>
                        </View>
                      </FadeIn>
                    ))}
                  </>
                ) : (
                  <>
                    <View style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
                      {a.providers.map((p, i) => (
                        <Row
                          key={p.source.id}
                          title={p.source.dataset_name}
                          detail={p.status}
                          last={i === a.providers.length - 1}
                          onPress={() => {
                            if (p.source.source_url.startsWith("https://"))
                              void Linking.openURL(p.source.source_url);
                          }}
                        />
                      ))}
                    </View>
                    <Text style={ui.section}>Next steps</Text>
                    <View style={[ui.card, { gap: 10 }]}>
                      {a.next_steps.map((n, i) => (
                        <View key={i} style={[ui.row, { alignItems: "flex-start" }]}>
                          <Text style={[ui.h3, { width: 20, color: c.tint }]}>{i + 1}</Text>
                          <Text style={[ui.body, { flex: 1, color: c.label }]}>{n}</Text>
                        </View>
                      ))}
                    </View>
                    {a.limitations.map((n, i) => (
                      <Text key={i} style={[ui.caption, { paddingHorizontal: 4 }]}>
                        {n}
                      </Text>
                    ))}
                  </>
                )}
              </View>
              <Button
                title="View Report"
                icon={<FileText size={18} color={c.onTint} />}
                onPress={report}
              />
              <Button outline title="Save to My Projects" onPress={save} />
            </>
          )
        )}
      </ScrollView>
    </View>
  );
}

export function ReportScreen({ back }: { back: () => void }) {
  const w = useWorkspace();
  const { c, ui } = useTheme();
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
      haptic.success();
    } catch (e) {
      haptic.warning();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={ui.page}>
      <Header title="Report" back={back} />
      <ScrollView contentContainerStyle={ui.content}>
        {a ? (
          <>
            <FadeIn>
              <View style={[s.cover, { backgroundColor: c.hero }]}>
                <Text style={{ ...type.footnote, color: "#fff", fontWeight: "700" }}>
                  Geo<Text style={{ color: "#D9B04F" }}>Mineral</Text>
                </Text>
                <Text style={{ ...type.title1, color: "#fff", marginTop: 24 }}>
                  {a.location.name}
                </Text>
                <Text style={{ ...type.footnote, color: "rgba(255,255,255,0.6)" }}>
                  {coordinates(a.location)} · {a.radius_km} km · {formatDate(a.created_at)}
                </Text>
              </View>
            </FadeIn>
            <FadeIn delay={80}>
              <View style={[ui.card, { gap: 12 }]}>
                <RatingPill rating={top?.prospectivity ?? a.rating} />
                <Text style={ui.title}>{top ? top.commodity : "No clear signal"}</Text>
                <View style={ui.row}>
                  <Stat label="Sites" value={a.occurrences.length} />
                  <Stat
                    label="Minerals"
                    value={a.assessments.filter((m) => m.prospectivity !== "Insufficient evidence").length}
                  />
                  <Stat label="Rock units" value={a.geology_units?.length ?? 0} />
                </View>
              </View>
            </FadeIn>
            <Text style={ui.section}>Includes</Text>
            <View style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
              {["Site map", "Mineral ratings", "Recorded sites", "Geology", "Next steps", "Sources"].map(
                (t, i, list) => (
                  <Row key={t} title={t} last={i === list.length - 1} />
                ),
              )}
            </View>
            <Button title="Export PDF" busy={busy} onPress={download} />
            {!!error && <Text style={ui.error}>{error}</Text>}
          </>
        ) : (
          <Empty title="No report yet" description="Analyze a location to create a report." />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  top: { position: "absolute", top: 0, left: 0, right: 0, padding: 16, gap: 10 },
  glassNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 0.5,
  },
  sheet: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 96,
    padding: 18,
    paddingTop: 22,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 0.5,
    boxShadow: "0px 12px 40px rgba(0,0,0,0.22)",
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginTop: -12,
    marginBottom: 8,
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  result: { borderRadius: 20, padding: 14 },
  preview: { height: 220, borderRadius: 26, overflow: "hidden" },
  cover: { borderRadius: 26, padding: 22, gap: 6 },
});
