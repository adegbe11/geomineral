import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { Camera, Check, ImagePlus, ScanLine, Sparkles } from "lucide-react-native";
import { Button, Header } from "./components/Primitives";
import { searchMinerals } from "./minerals";
import { api, ensureGuest, post } from "./services/api";
import { useWorkspace } from "./state/Workspace";
import { colors, ui } from "./theme";
import type { Project, ScanResult } from "./types";

async function preparePhoto(photo: { uri: string; width: number; height: number }) {
  const context = ImageManipulator.manipulate(photo.uri);
  context.resize(
    photo.width >= photo.height
      ? { width: Math.min(photo.width, 1280) }
      : { height: Math.min(photo.height, 1280) },
  );
  const image = await context.renderAsync();
  try {
    const result = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.8,
      base64: true,
    });
    if (!result.base64 || result.base64.length > 3_000_000)
      throw new Error("Photo too large");
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

export function Scanner({
  signIn,
  guide,
}: {
  signIn: () => void;
  guide: (query?: string) => void;
}) {
  const w = useWorkspace();
  const photos = w.scanPhotos,
    setPhotos = w.setScanPhotos,
    result = w.scanResult,
    review = w.scanReview,
    setReview = w.setScanReview;
  const camera = useRef<CameraView>(null);
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
        for (const asset of picked.assets.slice(0, 3))
          prepared.push(await preparePhoto(asset));
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
    } catch (e) {
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
        <ScrollView contentContainerStyle={ui.content}>
          <Image
            accessibilityLabel="Main photo"
            source={{ uri: photos[0] }}
            style={s.main}
          />
          {photos.length > 1 && (
            <View style={ui.row}>
              {photos.map((p, i) => (
                <Pressable
                  key={p}
                  accessibilityRole="button"
                  accessibilityLabel={`Use photo ${i + 1} as main`}
                  onPress={() =>
                    i && fresh([p, ...photos.filter((_, j) => j !== i)])
                  }
                >
                  <Image
                    source={{ uri: p }}
                    style={[s.thumb, i === 0 && s.thumbOn]}
                  />
                </Pressable>
              ))}
            </View>
          )}

          {result ? (
            <View style={[ui.card, { gap: 12 }]}>
              <View style={ui.between}>
                <Text style={ui.small}>Suggested · Unconfirmed</Text>
                {vision?.provider === "ollama" && (
                  <Text style={ui.small}>Local AI</Text>
                )}
              </View>
              {result.candidates?.length ? (
                <>
                  {result.candidates.map((name, i) => (
                    <Pressable
                      key={name}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose ${name}`}
                      onPress={() => {
                        setSuspected(name);
                        setMineralQuery(name);
                      }}
                      style={[s.match, suspected === name && s.matchOn]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={
                            i === 0 ? [ui.title, { fontSize: 26 }] : ui.h3
                          }
                        >
                          {name}
                        </Text>
                        {i === 0 && <Text style={ui.small}>Best match</Text>}
                      </View>
                      {suspected === name ? (
                        <Check size={18} color={colors.green} />
                      ) : null}
                    </Pressable>
                  ))}
                  {!!result.observations && (
                    <Text style={ui.body}>{result.observations}</Text>
                  )}
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
          ) : vision?.available ? (
            <View style={{ gap: 8 }}>
              <Button
                title={identifying ? "Identifying" : "Identify"}
                icon={
                  identifying ? undefined : <Sparkles size={17} color="#fff" />
                }
                busy={!!identifying}
                onPress={identify}
              />
              <Text style={[ui.small, { textAlign: "center" }]}>
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

          <View style={{ gap: 10 }}>
            <Text style={ui.label}>Title</Text>
            <TextInput
              accessibilityLabel="Sample title"
              value={title}
              onChangeText={setTitle}
              style={ui.field}
            />
            <Text style={ui.label}>Mineral</Text>
            <TextInput
              accessibilityLabel="Search suspected mineral"
              placeholder="Search minerals"
              placeholderTextColor="#9098A5"
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
                .map((m) => (
                  <Pressable
                    key={m.name}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${m.name}`}
                    onPress={() => {
                      setSuspected(m.name);
                      setMineralQuery(m.name);
                    }}
                    style={s.option}
                  >
                    <Text style={ui.h3}>{m.name}</Text>
                    <Text style={ui.small}>{m.formula}</Text>
                  </Pressable>
                ))}
            <Text style={ui.label}>Notes</Text>
            <TextInput
              accessibilityLabel="Field observations"
              value={notes}
              onChangeText={setNotes}
              placeholder="Colour, grain size, texture, weathering…"
              placeholderTextColor="#9098A5"
              multiline
              style={[ui.field, { minHeight: 96, textAlignVertical: "top" }]}
            />
            <Text style={ui.small}>{w.location.name}</Text>
          </View>
          {!!error && <Text style={ui.error}>{error}</Text>}
          {saved ? (
            <View style={[ui.row, { justifyContent: "center", padding: 8 }]}>
              <Check size={18} color={colors.green} />
              <Text style={[ui.h3, { color: colors.green }]}>Saved.</Text>
            </View>
          ) : (
            <Button
              title="Save"
              busy={busy}
              disabled={!title.trim()}
              onPress={chooseProject}
            />
          )}
          {pick && (
            <View style={ui.card}>
              <Text style={ui.h3}>Choose a project</Text>
              {!projects.length && <Text style={ui.body}>No projects yet.</Text>}
              {projects.map((p) => (
                <Button
                  key={p.id}
                  title={p.name}
                  outline
                  busy={busy}
                  onPress={() => record(p)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: "#0E201D", paddingBottom: 85 }}>
      <Header title="Scan" dark />
      <View style={s.viewfinder}>
        {permission?.granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <View style={{ padding: 25, gap: 22, alignItems: "center" }}>
            <ScanLine size={68} color="#93B5A2" />
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
        {permission?.granted && <View pointerEvents="none" style={s.frame} />}
      </View>
      <View style={{ padding: 22, gap: 16 }}>
        {!!error && <Text style={{ color: "#FFB4A9" }}>{error}</Text>}
        <View style={[ui.row, { justifyContent: "space-around" }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose photos"
            disabled={busy}
            onPress={gallery}
            style={s.cameraSmall}
          >
            <ImagePlus color="#E6EFE9" size={25} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            disabled={!permission?.granted || busy}
            onPress={capture}
            style={[s.shutter, { opacity: permission?.granted ? 1 : 0.4 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Camera size={34} color="#fff" />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review photos"
            disabled={!photos.length || busy}
            onPress={() => {
              setReview(true);
              setSaved(false);
            }}
            style={[s.cameraSmall, { opacity: photos.length ? 1 : 0.3 }]}
          >
            {photos.length > 0 ? (
              <Image
                source={{ uri: photos[photos.length - 1] }}
                style={{ width: 45, height: 45, borderRadius: 12 }}
              />
            ) : (
              <ImagePlus color="#A6BCAD" size={23} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  main: { height: 260, width: "100%", borderRadius: 22 },
  thumb: { width: 64, height: 64, borderRadius: 14, opacity: 0.7 },
  thumbOn: { opacity: 1, borderWidth: 2, borderColor: colors.green },
  match: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  matchOn: { borderColor: "#BFD8C6", backgroundColor: colors.pale },
  option: {
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    gap: 2,
  },
  viewfinder: {
    flex: 1,
    margin: 16,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#1C302B",
    justifyContent: "center",
  },
  frame: {
    position: "absolute",
    inset: 28,
    borderColor: "#B1E6B4",
    borderWidth: 2,
    borderRadius: 24,
  },
  cameraSmall: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "#52665D",
    backgroundColor: "#263B33",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#0E592D",
    borderWidth: 3,
    borderColor: "#DDEBDD",
    alignItems: "center",
    justifyContent: "center",
  },
});
