import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, PanResponder, Platform, Pressable, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Pause, Play } from "lucide-react-native";
import { haptic, useReduceMotion } from "../motion";
import { api } from "../services/api";
import { type, useTheme } from "../theme";
import type { GeologyUnit, Location } from "../types";

const native = Platform.OS !== "web";
const AGES = [0, 66, 100, 150, 200, 250, 300, 400, 500];
const ERA: Record<number, string> = {
  0: "Today",
  66: "End of the dinosaurs",
  100: "Cretaceous",
  150: "Jurassic",
  200: "Pangaea begins to split",
  250: "Great Dying, Permian–Triassic",
  300: "Pangaea assembles, Carboniferous",
  400: "Devonian, age of fishes",
  500: "Cambrian seas",
};
type Pos = { age: number; lat: number; lng: number } | null;
const coastCache = new Map<number, Promise<number[][][]>>();
const coasts = (age: number) => {
  if (!coastCache.has(age))
    coastCache.set(
      age,
      api<{ rings: number[][][] }>(`/deeptime/coastlines?age=${age}`, { signal: AbortSignal.timeout(60000) })
        .then((r) => r.rings)
        .catch((e) => {
          coastCache.delete(age);
          throw e;
        }),
    );
  return coastCache.get(age)!;
};
const pathOf = (rings: number[][][]) =>
  rings.map((r) => "M" + r.map(([x, y]) => `${(x + 180).toFixed(1)} ${(90 - y).toFixed(1)}`).join("L") + "Z").join("");
const zone = (lat: number) => {
  const a = Math.abs(lat);
  return a < 23.5 ? "Tropical" : a < 40 ? "Subtropical" : a < 66.5 ? "Temperate" : "Polar";
};
const latText = (lat: number) => `${Math.abs(lat).toFixed(0)}°${lat < 0 ? "S" : "N"}`;

export default function DeepTime({ location, units = [] }: { location: Location; units?: GeologyUnit[] }) {
  const { c, ui, dark } = useTheme();
  const still = useReduceMotion();
  const [positions, setPositions] = useState<Pos[] | null>(null),
    [index, setIndex] = useState(0),
    [paths, setPaths] = useState<Record<number, string>>({}),
    [error, setError] = useState(""),
    [playing, setPlaying] = useState(false),
    [width, setWidth] = useState(0),
    [track, setTrack] = useState(0);
  const age = AGES[index];
  const pos = positions?.[index];
  const fade = useRef(new Animated.Value(1)).current;
  const px = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const thumb = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    api<{ ages: Pos[] }>(`/deeptime?lat=${location.lat}&lng=${location.lng}`, {
      signal: AbortSignal.timeout(60000),
    })
      .then((r) => setPositions(r.ages))
      .catch(() => setError("Past positions are unavailable right now."));
  }, [location.lat, location.lng]);
  useEffect(() => {
    let live = true;
    coasts(age)
      .then((rings) => {
        if (!live) return;
        setPaths((p) => ({ ...p, [age]: pathOf(rings) }));
        if (!still) {
          fade.setValue(0.25);
          Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: native }).start();
        }
        // Warm the neighbouring ages so dragging feels instant.
        [AGES[index - 1], AGES[index + 1]].forEach((a) => a !== undefined && void coasts(a).catch(() => {}));
      })
      .catch(() => live && setError("Past maps are unavailable right now."));
    return () => {
      live = false;
    };
  }, [age]);
  const h = width / 2;
  useEffect(() => {
    if (!pos || !width) return;
    const to = { x: ((pos.lng + 180) / 360) * width, y: ((90 - pos.lat) / 180) * h };
    if (still) px.setValue(to);
    else Animated.spring(px, { toValue: to, speed: 8, bounciness: 6, useNativeDriver: native }).start();
  }, [pos?.lat, pos?.lng, width]);
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [still]);
  useEffect(() => {
    if (!track) return;
    const to = (index / (AGES.length - 1)) * track;
    if (still) thumb.setValue(to);
    else Animated.spring(thumb, { toValue: to, speed: 22, bounciness: 4, useNativeDriver: native }).start();
  }, [index, track]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setIndex((i) => {
        if (i >= AGES.length - 1) {
          setPlaying(false);
          return i;
        }
        haptic.select();
        return i + 1;
      });
    }, 1700);
    return () => clearInterval(t);
  }, [playing]);

  const choose = (i: number) => {
    const next = Math.max(0, Math.min(AGES.length - 1, i));
    setIndex((old) => {
      if (old !== next) haptic.select();
      return next;
    });
  };
  const trackRef = useRef(0);
  trackRef.current = track;
  const trackView = useRef<View>(null);
  const left = useRef(0);
  const at = (pageX: number) =>
    Math.round(((pageX - left.current) / trackRef.current) * (AGES.length - 1));
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          setPlaying(false);
          trackView.current?.measureInWindow((x) => {
            left.current = x;
            choose(at(e.nativeEvent.pageX));
          });
        },
        onPanResponderMove: (e) => choose(at(e.nativeEvent.pageX)),
      }),
    [],
  );
  const oldest = units
    .map((u) => Number(u.bottom_ma))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a)[0];

  return (
    <View style={{ gap: 14 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ borderRadius: 22, overflow: "hidden", backgroundColor: dark ? "#071B26" : "#0E3546" }}
      >
        {!!width && (
          <View style={{ width, height: h }}>
            <Animated.View style={{ opacity: fade }}>
              <Svg width={width} height={h} viewBox="0 0 360 180">
                <Rect width={360} height={180} fill="transparent" />
                {!!paths[age] && <Path d={paths[age]} fill={dark ? "#7A6C52" : "#D9C9A1"} />}
              </Svg>
            </Animated.View>
            {!paths[age] && !error && (
              <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            {pos && (
              <Animated.View
                pointerEvents="none"
                style={{ position: "absolute", left: -14, top: -14, transform: px.getTranslateTransform() }}
              >
                <Animated.View
                  style={{
                    position: "absolute",
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "#FF5A4E",
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] }) }],
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    left: 8,
                    top: 8,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: "#FF5A4E",
                    borderWidth: 2,
                    borderColor: "#fff",
                  }}
                />
              </Animated.View>
            )}
          </View>
        )}
      </View>

      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <Text style={ui.title}>{age ? `${age} million years ago` : "Today"}</Text>
        <Text style={ui.body}>{ERA[age]}</Text>
      </View>

      <View style={[ui.row, { gap: 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pause time travel" : "Play time travel"}
          onPress={() => {
            haptic.tap();
            if (!playing && index === AGES.length - 1) setIndex(0);
            setPlaying(!playing);
          }}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.tint, alignItems: "center", justifyContent: "center" }}
        >
          {playing ? <Pause size={18} color={c.onTint} fill={c.onTint} /> : <Play size={18} color={c.onTint} fill={c.onTint} />}
        </Pressable>
        <View
          {...pan.panHandlers}
          ref={trackView}
          accessibilityRole="adjustable"
          accessibilityLabel="Time"
          accessibilityValue={{ text: age ? `${age} million years ago` : "Today" }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => choose(index + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
          onLayout={(e) => setTrack(e.nativeEvent.layout.width)}
          style={{ flex: 1, height: 40, justifyContent: "center" }}
        >
          <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: c.fill }} />
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between" }}>
            {AGES.map((a) => (
              <View key={a} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.tertiary }} />
            ))}
          </View>
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: -12,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "#fff",
              boxShadow: "0px 2px 6px rgba(0,0,0,0.25)",
              transform: [{ translateX: thumb }],
            }}
          />
        </View>
      </View>
      <View style={[ui.between, { marginLeft: 52, marginTop: -10 }]}>
        <Text style={ui.caption}>Today</Text>
        <Text style={ui.caption}>500 Ma</Text>
      </View>

      <View style={[ui.card, { gap: 10 }]}>
        {positions === null && !error ? (
          <ActivityIndicator color={c.tint} />
        ) : pos ? (
          <View style={ui.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ui.caption}>This spot was at</Text>
              <Text style={ui.h2}>{latText(pos.lat)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ui.caption}>Climate belt</Text>
              <Text style={ui.h2}>{zone(pos.lat)}</Text>
            </View>
          </View>
        ) : (
          <Text style={ui.body}>{error || "No reliable position for this place at this age."}</Text>
        )}
        {!!oldest && (
          <>
            <View style={ui.divider} />
            <Text style={ui.body}>
              Oldest mapped rock here: about{" "}
              <Text style={{ ...type.subhead, fontWeight: "700", color: c.label }}>
                {oldest >= 1000 ? `${(oldest / 1000).toFixed(1)} billion` : `${Math.round(oldest)} million`} years
              </Text>
              .
            </Text>
          </>
        )}
      </View>
      <Text style={[ui.caption, { paddingHorizontal: 4 }]}>Plate models: Müller 2019, Merdith 2021 via GPlates.</Text>
    </View>
  );
}
