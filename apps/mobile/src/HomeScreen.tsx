import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import CrystalShimmer from "./components/CrystalShimmer";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { BookOpen, ChevronRight, FlaskConical, Folder, UserRound } from "lucide-react-native";
import { Brand, MineralArt } from "./components/Primitives";
import OrbitingEarth from "./components/OrbitingEarth";
import PlaceSearch from "./components/PlaceSearch";
import { minerals, pretty } from "./minerals";
import { EASE_OUT, EASE_REVEAL, FadeIn, Float, Pressy, SPRING_PRESS, useReduceMotion } from "./motion";
import { SPECIES_COUNT } from "./species";
import { useWorkspace } from "./state/Workspace";
import { ratingColor, ratingLabel, type } from "./theme";

const native = Platform.OS !== "web";
// Home always sits on the planet, like Apple Weather: one fixed glass-on-dark palette.
export const G = {
  top: "#06150F",
  bottom: "#0A2A21",
  text: "#FFFFFF",
  secondary: "rgba(255,255,255,0.8)",
  tertiary: "rgba(255,255,255,0.58)",
  glass: "rgba(255,255,255,0.09)",
  border: "rgba(255,255,255,0.16)",
  field: "rgba(0,0,0,0.24)",
  separator: "rgba(255,255,255,0.12)",
  pressed: "rgba(255,255,255,0.08)",
  tint: "#5FD39A",
  onTint: "#03140B",
};

// A different mineral each day, same for everyone.
const today = () => {
  const pool = minerals.filter((m) => !m.rock);
  return pool[Math.floor(Date.now() / 86_400_000) % pool.length];
};
// First sentence, ending cleanly.
const sentence = (text: string) => {
  const first = text.split(/(?<=\.)\s/)[0].trim();
  return /[.!?]$/.test(first) ? first : `${first}.`;
};

/** Ultra-thin material card with continuous corners. */
function Glass({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View style={[s.glass, style]}>
      <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

function GlassRow({
  title,
  detail,
  icon,
  last,
  onPress,
  label,
}: {
  title: string;
  detail?: string;
  icon: ReactNode;
  last?: boolean;
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingLeft: 18,
        backgroundColor: pressed ? G.pressed : "transparent",
      })}
    >
      {icon}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 15,
          paddingRight: 16,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderColor: G.separator,
        }}
      >
        <Text style={{ ...type.body, color: G.text, flex: 1 }} numberOfLines={1}>
          {title}
        </Text>
        {!!detail && (
          <Text style={{ ...type.subhead, color: G.secondary, maxWidth: "52%" }} numberOfLines={1}>
            {detail}
          </Text>
        )}
        <ChevronRight size={17} color={G.tertiary} />
      </View>
    </Pressable>
  );
}

export default function HomeScreen({
  analyze,
  guide,
  identify,
  openRecent,
  covered,
}: {
  /** True while another screen is stacked on top of Home. */
  covered: boolean;
  analyze: () => void;
  guide: (name?: string) => void;
  identify: () => void;
  openRecent: (id: string) => void;
}) {
  const w = useWorkspace();
  const y = useRef(new Animated.Value(0)).current;
  const featured = today();
  const still = useReduceMotion();
  // Analyze sequence: label out, spinner in, Earth zooms, panel settles, sheet rises.
  const [loading, setLoading] = useState(false);
  const label = useRef(new Animated.Value(1)).current;
  const zoom = useRef(new Animated.Value(1)).current;
  const panel = useRef(new Animated.Value(0)).current;
  function start() {
    if (loading) return;
    setLoading(true);
    if (still) return analyze();
    Animated.parallel([
      Animated.timing(label, { toValue: 0, duration: 150, easing: EASE_OUT, useNativeDriver: native }),
      Animated.timing(zoom, { toValue: 1.05, duration: 700, easing: EASE_OUT, useNativeDriver: native }),
      Animated.timing(panel, { toValue: 1, duration: 400, easing: EASE_REVEAL, useNativeDriver: native }),
    ]).start();
    setTimeout(analyze, 260);
  }
  useEffect(() => {
    if (covered || !loading) return;
    // Back on Home: everything returns to rest.
    setLoading(false);
    Animated.parallel([
      Animated.spring(label, { toValue: 1, ...SPRING_PRESS, useNativeDriver: native }),
      Animated.spring(zoom, { toValue: 1, ...SPRING_PRESS, useNativeDriver: native }),
      Animated.spring(panel, { toValue: 0, ...SPRING_PRESS, useNativeDriver: native }),
    ]).start();
  }, [covered]);
  return (
    <View style={{ flex: 1, backgroundColor: G.bottom }}>
      <LinearGradient
        colors={[G.top, "#0B2A23", "#0C3027", G.bottom]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              {
                translateY: y.interpolate({
                  inputRange: [-200, 0, 400],
                  outputRange: [60, 0, -140],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      >
        <OrbitingEarth style={s.earth} zoom={zoom} />
        <LinearGradient
          colors={["rgba(6,21,15,0.55)", "transparent", "rgba(6,21,15,0.35)", G.bottom]}
          locations={[0, 0.12, 0.3, 0.62]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 156 }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
          useNativeDriver: native,
        })}
      >
        <View style={s.heroTop}>
          <Brand light />
          <Pressy accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => w.setTab("Profile")} style={s.profile}>
            <UserRound size={19} color={G.text} />
          </Pressy>
        </View>
        <FadeIn delay={80} style={{ paddingHorizontal: 20, paddingTop: 96, paddingBottom: 28 }}>
          <Text accessibilityRole="header" style={{ ...type.largeTitle, color: G.text }}>
            Find hidden minerals{"\n"}around you.
          </Text>
        </FadeIn>

        <View style={{ paddingHorizontal: 16, gap: 28 }}>
          <FadeIn delay={140}>
            <Animated.View
              style={{
                opacity: panel.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }),
                transform: [
                  { translateY: panel.interpolate({ inputRange: [0, 1], outputRange: [0, 28] }) },
                  { scale: panel.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) },
                ],
              }}
            >
            <Glass style={{ padding: 14, gap: 12 }}>
              <PlaceSearch onSelect={w.selectLocation} tone="glass" current={w.location.name} />
              <Pressy
                accessibilityRole="button"
                accessibilityLabel="Analyze Location"
                accessibilityState={{ busy: loading }}
                onPress={start}
                scaleTo={0.96}
                style={s.primary}
              >
                <Animated.Text style={{ ...type.headline, color: G.onTint, opacity: label }}>
                  Analyze Location
                </Animated.Text>
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    opacity: label.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  }}
                >
                  {loading && <ActivityIndicator color={G.onTint} />}
                </Animated.View>
              </Pressy>
            </Glass>
            </Animated.View>
          </FadeIn>

          {w.recent.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={s.section}>Recent</Text>
              <Glass>
                {w.recent.slice(0, 4).map((r, i, list) => {
                  const top = r.result.assessments.find((a) => a.prospectivity !== "Insufficient evidence");
                  return (
                    <FadeIn key={r.id} index={i}>
                      <GlassRow
                        label={`Open analysis of ${r.location.name}`}
                        title={r.location.name}
                        detail={top ? `${top.commodity} · ${ratingLabel(top.prospectivity)}` : "No signal"}
                        last={i === list.length - 1}
                        onPress={() => openRecent(r.id)}
                        icon={<View style={[s.dot, { backgroundColor: ratingColor(top?.prospectivity) }]} />}
                      />
                    </FadeIn>
                  );
                })}
              </Glass>
            </View>
          )}

          <View style={{ gap: 10 }}>
            <Text style={s.section}>Mineral of the Day</Text>
            <FadeIn delay={200}>
              <Pressy
                accessibilityRole="button"
                accessibilityLabel={`Learn about ${featured.name}`}
                onPress={() => guide(featured.name)}
                scaleTo={0.97}
              >
                <Glass style={{ flexDirection: "row", alignItems: "center", gap: 16, padding: 16 }}>
                  <CrystalShimmer size={88}>
                    <View style={[s.art, { backgroundColor: featured.color + "33" }]}>
                      <Float>
                        <MineralArt color={featured.color} habit={featured.habit} size={68} />
                      </Float>
                    </View>
                  </CrystalShimmer>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ ...type.title3, color: G.text }}>{featured.name}</Text>
                    <Text style={{ ...type.subhead, color: G.secondary }}>{pretty(featured.formula)}</Text>
                    <Text style={{ ...type.subhead, color: G.secondary, marginTop: 4 }}>
                      {sentence(featured.traits)}
                    </Text>
                  </View>
                </Glass>
              </Pressy>
            </FadeIn>
          </View>

          <Glass>
            <GlassRow
              title="Mineral Guide"
              detail={SPECIES_COUNT.toLocaleString()}
              onPress={() => guide()}
              icon={<BookOpen size={20} color={G.tint} />}
            />
            <GlassRow title="Identify by Tests" onPress={identify} icon={<FlaskConical size={20} color={G.tint} />} />
            <GlassRow title="My Projects" last onPress={() => w.setTab("Projects")} icon={<Folder size={20} color={G.tint} />} />
          </Glass>
        </View>
      </Animated.ScrollView>

      {/* Content fades out above the tab bar instead of running into it. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(10,42,33,0)", "rgba(10,42,33,0.92)", G.bottom]}
        locations={[0, 0.55, 1]}
        style={s.scrim}
      />
    </View>
  );
}

const s = StyleSheet.create({
  earth: {
    position: "absolute",
    width: 460,
    height: 460,
    right: -150,
    top: -120,
    opacity: 0.95,
    borderRadius: 230,
  },
  heroTop: {
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: G.border,
    backgroundColor: G.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  glass: {
    borderRadius: 26,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: G.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: G.border,
  },
  primary: {
    minHeight: 50,
    borderRadius: 25,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: G.tint,
  },
  section: {
    ...type.footnote,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: G.secondary,
    marginLeft: 18,
  },
  art: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 150 },
});
