import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Award, Lock } from "lucide-react-native";
import { Empty, MineralArt } from "./components/Primitives";
import { badges, found, type Record } from "./badges";
import { minerals } from "./minerals";
import { FadeIn, haptic, Pressy, useReduceMotion } from "./motion";
import { api, getStored, setStored } from "./services/api";
import { useWorkspace } from "./state/Workspace";
import { type, useTheme } from "./theme";

const native = Platform.OS !== "web";

function Progress({ value, total }: { value: number; total: number }) {
  const { c, ui } = useTheme();
  const still = useReduceMotion();
  const r = 44,
    len = 2 * Math.PI * r;
  // A plain Circle driven by a listener: animated SVG props leak attributes on web.
  const v = useRef(new Animated.Value(still ? value / total : 0)).current;
  const [progress, setProgress] = useState(still ? value / total : 0);
  useEffect(() => {
    const id = v.addListener(({ value: p }) => setProgress(p));
    Animated.timing(v, { toValue: value / total, duration: 900, useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [value, total]);
  return (
    <View style={{ width: 108, height: 108, alignItems: "center", justifyContent: "center" }}>
      <Svg width={108} height={108} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={54} cy={54} r={r} stroke={c.fill} strokeWidth={10} fill="none" />
        <Circle
          cx={54}
          cy={54}
          r={r}
          stroke={c.tint}
          strokeWidth={10}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${len}`}
          strokeDashoffset={len * (1 - progress)}
        />
      </Svg>
      <Text style={ui.title}>{value}</Text>
      <Text style={[ui.caption, { marginTop: -4 }]}>of {total}</Text>
    </View>
  );
}

function BadgeTile({ b, fresh, index }: { b: ReturnType<typeof badges>[number]; fresh: boolean; index: number }) {
  const { c, ui } = useTheme();
  const pop = useRef(new Animated.Value(fresh ? 0.4 : 1)).current;
  useEffect(() => {
    if (fresh)
      Animated.spring(pop, { toValue: 1, speed: 6, bounciness: 14, delay: 300 + index * 80, useNativeDriver: native }).start();
  }, [fresh]);
  return (
    <Animated.View
      accessibilityLabel={`${b.name}${b.earned ? "" : ", locked"}`}
      style={[
        ui.card,
        { padding: 14, gap: 8, opacity: b.earned ? 1 : 0.55, transform: [{ scale: pop }] },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: b.earned ? b.color : c.fill,
        }}
      >
        {b.earned ? <Award size={22} color="#fff" /> : <Lock size={18} color={c.tertiary} />}
      </View>
      <View style={[ui.row, { gap: 6 }]}>
        <Text style={ui.h3}>{b.name}</Text>
        {fresh && <Text style={ui.badge}>New</Text>}
      </View>
      <Text style={ui.small}>{b.detail}</Text>
    </Animated.View>
  );
}

export default function Rockdex({ open, signIn }: { open: (name: string) => void; signIn: () => void }) {
  const w = useWorkspace();
  const { c, ui, dark } = useTheme();
  const [records, setRecords] = useState<Record[] | null>(null),
    [error, setError] = useState(""),
    [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!w.user) return;
    api<Record[]>("/records")
      .then(async (rows) => {
        setRecords(rows);
        const earned = badges(rows).filter((b) => b.earned).map((b) => b.id);
        const seen = new Set(JSON.parse((await getStored("gm-badges")) || "[]") as string[]);
        const newly = earned.filter((id) => !seen.has(id));
        if (newly.length) {
          setFresh(new Set(newly));
          haptic.success();
        }
        await setStored("gm-badges", JSON.stringify(earned));
      })
      .catch((e) => setError((e as Error).message));
  }, [w.user]);
  if (!w.user)
    return (
      <Empty title="Your Rockdex" description="Sign in to collect minerals and earn badges.">
        <Pressy accessibilityRole="button" onPress={signIn} style={{ alignItems: "center", padding: 12 }}>
          <Text style={{ ...type.headline, color: c.tint }}>Sign In</Text>
        </Pressy>
      </Empty>
    );
  if (error) return <Text style={ui.error}>{error}</Text>;
  if (!records) return <ActivityIndicator color={c.tint} />;
  const have = found(records);
  const list = badges(records);
  return (
    <View style={{ gap: 16 }}>
      <FadeIn>
        <View style={[ui.card, ui.row, { gap: 18, padding: 18 }]}>
          <Progress value={have.size} total={minerals.length} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={ui.h2}>Collected</Text>
            <Text style={ui.body}>
              {list.filter((b) => b.earned).length} of {list.length} badges
            </Text>
          </View>
        </View>
      </FadeIn>
      <Text style={ui.section}>Badges</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {list.map((b, i) => (
          <FadeIn key={b.id} index={i} style={{ width: "47.8%" }}>
            <BadgeTile b={b} fresh={fresh.has(b.id)} index={i} />
          </FadeIn>
        ))}
      </View>
      <Text style={ui.section}>Cabinet</Text>
      <View style={[ui.card, { flexDirection: "row", flexWrap: "wrap", padding: 10, gap: 0 }]}>
        {minerals.map((m) => {
          const got = have.has(m.name);
          return (
            <Pressy
              key={m.name}
              accessibilityRole="button"
              accessibilityLabel={`${m.name}${got ? ", collected" : ""}`}
              onPress={() => open(m.name)}
              style={{ width: 64, alignItems: "center", paddingVertical: 8, gap: 4 }}
            >
              <View style={{ opacity: got ? 1 : 0.22 }}>
                <MineralArt color={got ? m.color : dark ? "#8E8E93" : "#9A9F9B"} habit={m.habit} size={38} />
              </View>
              <Text numberOfLines={1} style={{ ...type.caption2, color: got ? c.label : c.tertiary }}>
                {got ? m.name : "?"}
              </Text>
            </Pressy>
          );
        })}
      </View>
    </View>
  );
}
