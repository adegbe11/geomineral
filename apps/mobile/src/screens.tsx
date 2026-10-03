import { searchMinerals } from "./minerals";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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
import { Camera, ImagePlus, ScanLine } from "lucide-react-native";
import { Button, Header, Notice } from "./components/Primitives";
import { useWorkspace } from "./state/Workspace";
import { api, post } from "./services/api";
import { colors, ui } from "./theme";
import type { Project } from "./types";
export function Scanner({ signIn }: { signIn: () => void }) {
  async function preparePhoto(photo: {
    uri: string;
    width: number;
    height: number;
  }) {
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
  const [visionReady, setVisionReady] = useState(false);
  const [visionProvider, setVisionProvider] = useState("");
  const [identification, setIdentification] = useState<{
    candidate: string;
    observations: string;
    next_check: string;
  } | null>(null);
  useEffect(() => {
    api<{ available: boolean; provider: string }>("/scan/status")
      .then((s) => {
        setVisionReady(s.available);
        setVisionProvider(s.provider);
      })
      .catch(() => {});
  }, []);
  const [mineralQuery, setMineralQuery] = useState("");
  const [suspectedMineral, setSuspectedMineral] = useState("");
  const w = useWorkspace(),
    camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState<string[]>([]),
    [review, setReview] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [title, setTitle] = useState("Field rock sample"),
    [notes, setNotes] = useState(""),
    [projects, setProjects] = useState<Project[]>([]),
    [pick, setPick] = useState(false),
    [saved, setSaved] = useState(false);
  async function capture() {
    setBusy(true);
    setError("");
    try {
      const photo = await camera.current?.takePictureAsync({
        quality: 0.5,
      });
      if (photo) {
        const prepared = await preparePhoto(photo);
        setPhotos((p) => [...p, prepared].slice(-3));
        setIdentification(null);
        setSaved(false);
      }
    } catch {
      setError(
        "Could not take a photo. Try again or choose one from your library.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function gallery() {
    setBusy(true);
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.5,
        allowsMultipleSelection: true,
        selectionLimit: 3,
      });
      if (!result.canceled) {
        const prepared = [];
        for (const asset of result.assets.slice(0, 3))
          prepared.push(await preparePhoto(asset));
        setPhotos(prepared);
        setIdentification(null);
        setSuspectedMineral("");
        setMineralQuery("");
        setSaved(false);
      }
    } catch {
      setError("Could not open this photo. Choose a JPEG or PNG.");
    } finally {
      setBusy(false);
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
            suspectedMineral
              ? `Suspected identification: ${suspectedMineral}.`
              : "",
            notes,
            identification?.observations,
            identification?.next_check,
          ]
            .filter(Boolean)
            .join("\n") ||
          "Visual field observation; identification not confirmed.",
        location: w.location,
        rock_type: suspectedMineral || "Unidentified",
        method: identification
          ? "AI visual suggestion; unconfirmed"
          : suspectedMineral
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
  async function identifyPhotos() {
    if (!w.user) {
      signIn();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        candidate: string;
        observations: string;
        next_check: string;
      }>("/scan", {
        method: "POST",
        body: JSON.stringify({ photos }),
        signal: AbortSignal.timeout(240000),
      });
      setIdentification(result);
      setSuspectedMineral(
        result.candidate === "Unidentified" ? "" : result.candidate,
      );
      setMineralQuery(
        result.candidate === "Unidentified" ? "" : result.candidate,
      );
      setSaved(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (review)
    return (
      <View style={ui.page}>
        <Header title="Rock Observation" back={() => setReview(false)} />
        <ScrollView contentContainerStyle={ui.content}>
          {photos.length > 1 && <Text style={ui.small}>Main photo</Text>}
          <Image
            source={{ uri: photos[0] }}
            style={{ height: 235, width: "100%", borderRadius: 16 }}
          />
          <View style={ui.row}>
            {photos.slice(1).map((p) => (
              <Image
                key={p}
                source={{ uri: p }}
                style={{ width: 70, height: 70, borderRadius: 10 }}
              />
            ))}
          </View>

          {visionReady ? (
            <>
              <Button title="Identify" busy={busy} onPress={identifyPhotos} />
              <Text style={ui.small}>
                {visionProvider === "ollama"
                  ? "Local AI · No API fees"
                  : "Photos sent to OpenAI for identification."}
              </Text>
            </>
          ) : (
            <Notice>Identification not connected.</Notice>
          )}
          {identification && (
            <View style={ui.card}>
              <Text style={ui.h2}>{identification.candidate}</Text>
              <Text style={ui.small}>Suggested · Unconfirmed</Text>
              <Text style={ui.body}>{identification.observations}</Text>
              <Text style={ui.body}>{identification.next_check}</Text>
            </View>
          )}
          <TextInput
            accessibilityLabel="Sample title"
            value={title}
            onChangeText={setTitle}
            style={ui.field}
          />
          <TextInput
            accessibilityLabel="Field observations"
            value={notes}
            onChangeText={setNotes}
            placeholder="Colour, grain size, texture, weathering…"
            multiline
            style={[ui.field, { minHeight: 100, textAlignVertical: "top" }]}
          />
          <Text style={ui.h3}>Suspected mineral</Text>
          <TextInput
            accessibilityLabel="Search suspected mineral"
            placeholder="Mineral"
            value={mineralQuery}
            onChangeText={(value) => {
              setMineralQuery(value);
              setSuspectedMineral("");
            }}
            style={ui.field}
          />
          {!!mineralQuery &&
            !suspectedMineral &&
            searchMinerals(mineralQuery)
              .slice(0, 5)
              .map((m) => (
                <Button
                  outline
                  key={m.name}
                  title={`Select ${m.name}`}
                  onPress={() => {
                    setSuspectedMineral(m.name);
                    setMineralQuery(m.name);
                  }}
                />
              ))}
          {!!suspectedMineral && (
            <Notice>{suspectedMineral}: suspected only, not confirmed.</Notice>
          )}
          <Text style={ui.small}>{w.location.name}</Text>
          {!!error && <Text style={ui.error}>{error}</Text>}
          {saved ? (
            <Notice>Saved.</Notice>
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
              {!projects.length && (
                <Text style={ui.body}>No projects yet.</Text>
              )}
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
      <View
        style={{
          flex: 1,
          margin: 16,
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: "#1C302B",
          justifyContent: "center",
        }}
      >
        {permission?.granted ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
          />
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
        {permission?.granted && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              inset: 28,
              borderColor: "#B1E6B4",
              borderWidth: 2,
              borderRadius: 24,
            }}
          />
        )}
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
