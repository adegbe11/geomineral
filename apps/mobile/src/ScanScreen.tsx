import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Check, ImagePlus, ScanLine, Sparkles } from "lucide-react-native";
import { Button, Header, MineralArt } from "./components/Primitives";
import { findMineral, pretty, searchMinerals } from "./minerals";
import { FadeIn, haptic, Pressy, useReduceMotion } from "./motion";
import { api, ensureGuest, post } from "./services/api";
import { useWorkspace } from "./state/Workspace";
import { type, useTheme } from "./theme";
import type { Project, ScanResult } from "./types";

const native = Platform.OS !== "web";

async function preparePhoto(photo: { uri: string; width: number; height: number }) {
  const context = ImageManipulator.manipulate(photo.uri);
  context.resize(
    photo.width >= photo.height
      ? { width: Math.min(photo.width, 1280) }
      : { height: Math.min(photo.height, 1280) },
  );
  const image = await context.renderAsync();
  try {
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
    if (!result.base64 || result.base64.length > 3_000_000) throw new Error("Photo too large");
    return `data:image/jpeg;base64,${result.base64}`;
  } finally {
    image.release();
    context.release();
  }
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{Math.max(0, Math.round((now - since) / 1000))}s</>;
}

/** A light band that sweeps over the photo while the model looks at it. */
function ScanSweep({ height }: { height: number }) {
  const still = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: native,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [still]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4,20,15,0.25)" }]} />
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 70,
          backgroundColor: "rgba(130,230,180,0.22)",
          borderBottomWidth: 2,
          borderColor: "#8BF0BE",
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-70, height] }) },
          ],
        }}
      />
    </View>
  );
}

/** Viewfinder corners that breathe slowly. */
function Corners() {
  const still = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still]);
  const corner = (pos: object, borders: object) => (
    <View style={[{ position: "absolute", width: 34, height: 34, borderColor: "#fff" }, pos, borders]} />
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        inset: 40,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }],
      }}
    >
      {corner({ top: 0, left: 0 }, { borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 })}
      {corner({ top: 0, right: 0 }, { borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 })}
      {corner({ bottom: 0, left: 0 }, { borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 })}
      {corner({ bottom: 0, right: 0 }, { borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 })}
    </Animated.View>
  );
}

export function Scanner({
  signIn,
  guide,
}: {
  signIn: () => void;
  guide: (query?: string) => void;
}) {
  const w = useWorkspace();
  const { c, ui } = useTheme();
  const photos = w.scanPhotos,
    setPhotos = w.setScanPhotos,
    result = w.scanResult,
    review = w.scanReview,
    setReview = w.setScanReview;
  const camera = useRef<CameraView>(null);
  const flash = useRef(new Animated.Value(0)).current;
  const [permission, requestPermission] = useCameraPermissions();
  const [vision, setVision] = useState<{ available: boolean; provider: string }>();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [identifying, setIdentifying] = useState(0),
    [title, setTitle] = useState("Field rock sample"),
    [notes, setNotes] = useState(""),
    [mineralQuery, setMineralQuery] = useState(""),
    [suspected, setSuspected] = useState(""),
    [projects, setProjects] = useState<Project[]>([]),
    [pick, setPick] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    api<{ available: boolean; provider: string }>("/scan/status")
      .then(setVision)
      .catch(() => setVision({ available: false, provider: "" }));
  }, []);
  useEffect(() => {
    const top = result?.candidates?.[0];
    setSuspected(top ?? "");
    setMineralQuery(top ?? "");
  }, [result]);
  function fresh(next: string[]) {
    setPhotos(next);
    w.setScanResult(null);
    setSaved(false);
  }
  async function capture() {
    setBusy(true);
    setError("");
    haptic.heavy();
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 380, useNativeDriver: native }).start();
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.5 });
      if (photo) fresh([...photos, await preparePhoto(photo)].slice(-3));
    } catch {
      setError("Could not take a photo. Try again or choose one from your library.");
    } finally {
      setBusy(false);
    }
  }
  async function gallery() {
    setBusy(true);
    setError("");
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.5,
        allowsMultipleSelection: true,
        selectionLimit: 3,
      });
      if (!picked.canceled) {
        const prepared = [];
        for (const asset of picked.assets.slice(0, 3)) prepared.push(await preparePhoto(asset));
        fresh(prepared);
      }
    } catch {
      setError("Could not open this photo. Choose a JPEG or PNG.");
    } finally {
      setBusy(false);
    }
  }
  async function identify() {
    setIdentifying(Date.now());
    setError("");
    try {
      await ensureGuest();
      const found = await api<ScanResult>("/scan", {
        method: "POST",
        body: JSON.stringify({ photos: [photos[0]] }),
        signal: AbortSignal.timeout(300000),
      });
      w.setScanResult(found);
      setSaved(false);
      if (found.candidates?.length) haptic.success();
      else haptic.warning();
    } catch (e) {
      haptic.warning();
      setError((e as Error).message);
    } finally {
      setIdentifying(0);
    }
  }
  async function chooseProject() {
    if (!w.user) {
      signIn();
      return;
    }
    setBusy(true);
    setError("");
    try {
      setProjects(await api<Project[]>("/projects"));
      setPick(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function record(p: Project) {
    setBusy(true);
    try {
      await post(`/projects/${p.id}/records`, {
        kind: "sample",
        title,
        description:
          [
            suspected ? `Suspected identification: ${suspected}.` : "",
            notes,
            result?.observations,
            result?.next_check,
          ]
            .filter(Boolean)
            .join("\n") || "Visual field observation; identification not confirmed.",
        location: w.location,
        rock_type: suspected || "Unidentified",
        method: result
          ? "AI visual suggestion; unconfirmed"
          : suspected
            ? "Suspected visual identification"
            : "Visual observation",
        chain_of_custody: "Not recorded",
        photos,
      });
      setSaved(true);
      setPick(false);
      haptic.success();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (review)
    return (
      <View style={ui.page}>
        <Header title="Sample" back={() => setReview(false)} />
        <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
          <FadeIn>
            <View style={s.main}>
              <Image
                accessibilityLabel="Main photo"
                source={{ uri: photos[0] }}
                style={StyleSheet.absoluteFill}
              />
              {!!identifying && <ScanSweep height={280} />}
            </View>
          </FadeIn>
          {photos.length > 1 && (
            <View style={ui.row}>
              {photos.map((p, i) => (
                <Pressy
                  key={p}
                  accessibilityRole="button"
                  accessibilityLabel={`Use photo ${i + 1} as main`}
                  onPress={() => i && fresh([p, ...photos.filter((_, j) => j !== i)])}
                >
                  <Image
                    source={{ uri: p }}
                    style={[s.thumb, i === 0 && { opacity: 1, borderWidth: 2, borderColor: c.tint }]}
                  />
                </Pressy>
              ))}
            </View>
          )}

          {result ? (
            <FadeIn>
              <View style={[ui.card, { gap: 10 }]}>
                <View style={ui.between}>
                  <Text style={ui.caption}>Suggested · Unconfirmed</Text>
                  {vision?.provider === "ollama" && <Text style={ui.caption}>Local AI</Text>}
                </View>
                {result.candidates?.length ? (
                  <>
                    {result.candidates.map((name, i) => {
                      const known = findMineral(name);
                      const on = suspected === name;
                      return (
                        <FadeIn key={name} index={i} delay={60}>
                          <Pressy
                            accessibilityRole="button"
                            accessibilityLabel={`Choose ${name}`}
                            scaleTo={0.98}
                            onPress={() => {
                              haptic.select();
                              setSuspected(name);
                              setMineralQuery(name);
                            }}
                            style={[
                              s.match,
                              { backgroundColor: on ? c.tintSoft : c.fill },
                            ]}
                          >
                            {known && (
                              <MineralArt color={known.color} habit={known.habit} size={i === 0 ? 46 : 32} />
                            )}
                            <View style={{ flex: 1, gap: 1 }}>
                              <Text style={i === 0 ? ui.title : ui.h3}>{name}</Text>
                              {i === 0 && <Text style={ui.small}>Best match</Text>}
                            </View>
                            {on && <Check size={20} color={c.tint} strokeWidth={3} />}
                          </Pressy>
                        </FadeIn>
                      );
                    })}
                    {!!result.observations && <Text style={ui.body}>{result.observations}</Text>}
                    <Button
                      outline
                      title={`About ${suspected || result.candidates[0]}`}
                      onPress={() => guide(suspected || result.candidates![0])}
                    />
                  </>
                ) : (
                  <>
                    <Text style={ui.h2}>{result.candidate}</Text>
                    <Text style={ui.body}>{result.next_check}</Text>
                  </>
                )}
              </View>
            </FadeIn>
          ) : vision?.available ? (
            <View style={{ gap: 8 }}>
              <Button
                title={identifying ? "Identifying" : "Identify"}
                icon={identifying ? undefined : <Sparkles size={18} color={c.onTint} />}
                busy={!!identifying}
                onPress={identify}
              />
              <Text style={[ui.caption, { textAlign: "center" }]}>
                {identifying ? (
                  <Elapsed since={identifying} />
                ) : vision.provider === "ollama" ? (
                  "Local AI · No API fees"
                ) : (
                  "Photos sent to OpenAI for identification."
                )}
              </Text>
            </View>
          ) : null}

          <Text style={ui.section}>Details</Text>
          <View style={[ui.card, { gap: 12 }]}>
            <TextInput
              accessibilityLabel="Sample title"
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={c.tertiary}
              style={ui.field}
            />
            <TextInput
              accessibilityLabel="Search suspected mineral"
              placeholder="Mineral"
              placeholderTextColor={c.tertiary}
              value={mineralQuery}
              onChangeText={(value) => {
                setMineralQuery(value);
                setSuspected("");
              }}
              style={ui.field}
            />
            {!!mineralQuery &&
              !suspected &&
              searchMinerals(mineralQuery)
                .slice(0, 5)
                .map((m, i) => (
                  <FadeIn key={m.name} index={i}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${m.name}`}
                      onPress={() => {
                        haptic.select();
                        setSuspected(m.name);
                        setMineralQuery(m.name);
                      }}
                      style={({ pressed }) => [
                        ui.row,
                        { padding: 10, borderRadius: 12, backgroundColor: pressed ? c.fill : "transparent" },
                      ]}
                    >
                      <MineralArt color={m.color} habit={m.habit} size={28} />
                      <Text style={[ui.h3, { flex: 1 }]}>{m.name}</Text>
                      <Text style={ui.small}>{pretty(m.formula)}</Text>
                    </Pressable>
                  </FadeIn>
                ))}
            <TextInput
              accessibilityLabel="Field observations"
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes: colour, grain size, texture"
              placeholderTextColor={c.tertiary}
              multiline
              style={[ui.field, { minHeight: 96, textAlignVertical: "top" }]}
            />
            <Text style={ui.caption}>{w.location.name}</Text>
          </View>
          {!!error && <Text style={ui.error}>{error}</Text>}
          {saved ? (
            <FadeIn>
              <View style={[ui.row, { justifyContent: "center", padding: 8 }]}>
                <Check size={20} color={c.tint} strokeWidth={3} />
                <Text style={[ui.h3, { color: c.tint }]}>Saved.</Text>
              </View>
            </FadeIn>
          ) : (
            <Button title="Save" busy={busy} disabled={!title.trim()} onPress={chooseProject} />
          )}
          {pick && (
            <FadeIn>
              <View style={[ui.card, { gap: 10 }]}>
                <Text style={ui.h3}>Choose a project</Text>
                {!projects.length && <Text style={ui.body}>No projects yet.</Text>}
                {projects.map((p) => (
                  <Button key={p.id} title={p.name} outline busy={busy} onPress={() => record(p)} />
                ))}
              </View>
            </FadeIn>
          )}
        </ScrollView>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingBottom: 92 }}>
      <Header title="Scan" dark />
      <View style={s.viewfinder}>
        {permission?.granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <View style={{ padding: 28, gap: 22, alignItems: "center" }}>
            <ScanLine size={60} color="rgba(255,255,255,0.5)" />
            <Button
              title="Enable Camera"
              onPress={() =>
                void requestPermission().catch(() =>
                  setError("Camera permission could not be requested."),
                )
              }
            />
          </View>
        )}
        {permission?.granted && <Corners />}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: flash }]}
        />
      </View>
      <View style={{ paddingHorizontal: 28, paddingVertical: 18, gap: 14 }}>
        {!!error && <Text style={{ ...type.footnote, color: "#FF9F95" }}>{error}</Text>}
        <View style={[ui.row, { justifyContent: "space-between" }]}>
          <Pressy
            accessibilityRole="button"
            accessibilityLabel="Choose photos"
            disabled={busy}
            onPress={gallery}
            style={s.side}
          >
            <ImagePlus color="#fff" size={24} />
          </Pressy>
          <Pressy
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            disabled={!permission?.granted || busy}
            onPress={capture}
            feedback={false}
            scaleTo={0.9}
            style={[s.shutterRing, { opacity: permission?.granted ? 1 : 0.35 }]}
          >
            <View style={s.shutter}>{busy && <ActivityIndicator color="#000" />}</View>
          </Pressy>
          <Pressy
            accessibilityRole="button"
            accessibilityLabel="Review photos"
            disabled={!photos.length || busy}
            onPress={() => {
              setReview(true);
              setSaved(false);
            }}
            style={[s.side, { opacity: photos.length ? 1 : 0.35 }]}
          >
            {photos.length > 0 ? (
              <Image
                source={{ uri: photos[photos.length - 1] }}
                style={{ width: 48, height: 48, borderRadius: 12 }}
              />
            ) : (
              <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#fff" }} />
            )}
          </Pressy>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  main: { height: 280, borderRadius: 26, overflow: "hidden", backgroundColor: "#111" },
  thumb: { width: 60, height: 60, borderRadius: 14, opacity: 0.6 },
  match: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16 },
  viewfinder: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#141414",
    justifyContent: "center",
  },
  side: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
