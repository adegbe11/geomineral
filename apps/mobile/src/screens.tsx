import { searchMinerals } from "./minerals";
import { BlurView } from "expo-blur";
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
import * as LocationService from "expo-location";
import { exportReport } from "./services/reportExport";
import {
  Camera,
  ImagePlus,
  MapPin,
  Navigation,
  ScanLine,
} from "lucide-react-native";
import NativeMap from "./components/NativeMap";
import { Button, Empty, Header, Notice } from "./components/Primitives";
import PlaceSearch from "./components/PlaceSearch";
import { useWorkspace } from "./state/Workspace";
import { api, coordinates, post } from "./services/api";
import { colors, ui } from "./theme";
import type { Project } from "./types";
export function Explore({
  analyze,
  save,
}: {
  analyze: () => void;
  save: () => void;
}) {
  const w = useWorkspace();
  const [satellite, setSatellite] = useState(true),
    [drawing, setDrawing] = useState(false),
    [error, setError] = useState("");
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
          onSelect={(p) =>
            drawing
              ? w.setPolygon([...w.polygon, [p.lng, p.lat]])
              : w.selectLocation(p)
          }
        />
      </View>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: 20,
          gap: 13,
        }}
      >
        <View
          style={[ui.between, { paddingHorizontal: 5, paddingVertical: 5 }]}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "600",
              letterSpacing: -0.8,
              color: "#fff",
              textShadowColor: "#0008",
              textShadowRadius: 10,
            }}
          >
            Explore
          </Text>
        </View>
        <PlaceSearch dark onSelect={w.selectLocation} />
        <View
          style={{
            flexDirection: "row",
            alignSelf: "flex-start",
            padding: 5,
            gap: 4,
            borderRadius: 26,
            overflow: "hidden",
            backgroundColor: "#F3F5EBE8",
          }}
        >
          <BlurView
            intensity={50}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          {["Satellite", "Street", "Draw area"].map((label, i) => (
            <Pressable
              accessibilityRole="button"
              key={label}
              onPress={() =>
                i === 2 ? setDrawing(!drawing) : setSatellite(i === 0)
              }
              style={{
                paddingHorizontal: 16,
                paddingVertical: 11,
                borderRadius: 22,
                backgroundColor: (i === 2 ? drawing : satellite === (i === 0))
                  ? "#245B40"
                  : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: (i === 2 ? drawing : satellite === (i === 0))
                    ? "#fff"
                    : "#486050",
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use current location"
        onPress={locate}
        style={{
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
        }}
      >
        <Navigation size={21} color={colors.green} />
      </Pressable>
      {drawing && (
        <View
          style={{
            position: "absolute",
            left: 21,
            right: 82,
            top: 225,
            padding: 15,
            borderRadius: 20,
            backgroundColor: "#F8FBF0EC",
          }}
        >
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
      <View
        style={{
          position: "absolute",
          left: 15,
          right: 15,
          bottom: 98,
          padding: 21,
          gap: 13,
          borderRadius: 29,
          overflow: "hidden",
          backgroundColor: "#F6F9EFEF",
          borderWidth: 1,
          borderColor: "#FFFFFF99",
          boxShadow: "0px 10px 35px #0003",
        }}
      >
        <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
        <View
          style={{
            width: 32,
            height: 4,
            backgroundColor: "#CBD2C8",
            borderRadius: 3,
            alignSelf: "center",
            marginTop: -10,
          }}
        />

        <View style={ui.row}>
          <View
            style={{
              backgroundColor: "#DFE9D7",
              padding: 12,
              borderRadius: 18,
            }}
          >
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
          >
            <Text style={{ fontSize: 12, color: colors.green }}>Save</Text>
          </Pressable>
        </View>
        {!!error && <Text style={ui.error}>{error}</Text>}
        <Button title="Analyze Location" onPress={analyze} />
        <Text style={{ fontSize: 10, color: "#7B8978", textAlign: "center" }}>
          25 km radius
        </Text>
      </View>
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
  const [tab, setTab] = useState("Overview");
  const a = w.analysis;
  return (
    <>
      <Header title="Location Analysis" back={back} />
      <ScrollView contentContainerStyle={ui.content}>
        <View style={ui.row}>
          <MapPin color={colors.green} size={23} />
          <View style={{ flex: 1 }}>
            <Text style={ui.h3}>{w.location.name}</Text>
            <Text style={ui.small}>{coordinates(w.location)}</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={ui.row}>
            {["Overview", "Geology", "Evidence", "Next Steps"].map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 9,
                  borderBottomWidth: 2,
                  borderColor: tab === t ? colors.green : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: tab === t ? colors.green : colors.muted,
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        {!a && !w.error ? (
          <View
            style={[ui.card, { paddingVertical: 45, alignItems: "center" }]}
          >
            <ActivityIndicator color={colors.green} />
            <Text style={ui.h2}>Analyzing…</Text>
            <Text style={ui.body}>
              {w.status === "queued" ? "Queued" : "Checking sources"}
            </Text>
          </View>
        ) : w.error ? (
          <Empty title="Analysis unavailable" description={w.error}>
            <Button title="Try Again" onPress={() => void w.analyze()} />
          </Empty>
        ) : (
          a && (
            <>
              {tab === "Overview" ? (
                <>
                  <View style={ui.card}>
                    <Text style={ui.h3}>Mineral Potential</Text>
                    <Text
                      style={[ui.title, { color: colors.green, fontSize: 24 }]}
                    >
                      {a.assessments[0]?.prospectivity ||
                        "Insufficient evidence"}
                    </Text>
                    <Text style={ui.body}>{a.summary}</Text>
                    <View style={{ height: 1, backgroundColor: colors.line }} />
                    <Text style={ui.small}>
                      Evidence quality: {a.evidence_quality}
                    </Text>
                  </View>
                  <Text style={ui.h2}>Mineral screening</Text>
                  {a.assessments.map((m) => (
                    <View key={m.commodity} style={ui.card}>
                      <View style={ui.between}>
                        <Text style={ui.h3}>{m.commodity}</Text>
                        <Text style={{ color: colors.green, fontSize: 11 }}>
                          {m.prospectivity}
                        </Text>
                      </View>
                      <Text style={ui.body}>{m.explanation}</Text>
                      <Button
                        outline
                        title={`Learn about ${m.commodity}`}
                        onPress={() => guide(m.commodity)}
                      />
                      <Text style={ui.small}>
                        Evidence quality: {m.evidence_quality}
                      </Text>
                    </View>
                  ))}
                </>
              ) : tab === "Geology" ? (
                <>
                  {a.coverage.map((c) => (
                    <View key={c.name} style={ui.card}>
                      <Text style={ui.h3}>{c.name}</Text>
                      <Text style={{ color: colors.green, fontSize: 12 }}>
                        {c.status}
                      </Text>
                      <Text style={ui.body}>{c.detail}</Text>
                    </View>
                  ))}
                </>
              ) : tab === "Evidence" ? (
                <>
                  {a.evidence.length === 0 && (
                    <Notice>No evidence returned.</Notice>
                  )}
                  {a.evidence.map((e) => (
                    <View key={e.id} style={ui.card}>
                      <Text style={ui.h3}>
                        {e.evidence_type.replaceAll("_", " ")}
                      </Text>
                      <Text style={ui.body}>{e.description}</Text>
                      <Text style={ui.small}>
                        {e.observed_or_inferred} • {e.reliability}
                      </Text>
                      {w.professional && (
                        <Text style={ui.small}>
                          Source: {e.source_id} • {e.id}
                        </Text>
                      )}
                    </View>
                  ))}
                  {a.providers.map((p) => (
                    <View key={p.source.id} style={ui.card}>
                      <Text style={ui.h3}>{p.source.dataset_name}</Text>
                      <Text style={ui.body}>{p.message}</Text>
                      <Pressable
                        onPress={() => {
                          if (p.source.source_url.startsWith("https://"))
                            void Linking.openURL(p.source.source_url);
                        }}
                      >
                        <Text style={{ color: colors.green, fontSize: 12 }}>
                          Open source ↗
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </>
              ) : (
                <>
                  {a.next_steps.map((s, i) => (
                    <View key={i} style={ui.card}>
                      <Text style={ui.h3}>0{i + 1}</Text>
                      <Text style={ui.body}>{s}</Text>
                    </View>
                  ))}
                  {a.limitations.map((s, i) => (
                    <Notice key={i}>{s}</Notice>
                  ))}
                </>
              )}
              <Notice>Screening only. Deposits unconfirmed.</Notice>
              <Button title="View Full Report" onPress={report} />
              <Button outline title="Save to My Projects" onPress={save} />
            </>
          )
        )}
      </ScrollView>
    </>
  );
}
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
const escapeHTML = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function ReportScreen({ back }: { back: () => void }) {
  const w = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const a = w.analysis;
  async function download() {
    if (!a) return;
    setBusy(true);
    setError("");
    try {
      const html = `<html><head><meta charset="utf-8"/><style>body{font:14px Arial;color:#142c20;padding:35px}h1{font-size:28px}section{margin:20px 0;border-bottom:1px solid #ddd;padding-bottom:15px}p{line-height:1.6}</style></head><body><h1>GeoMineral · Exploration Report</h1><h2>${escapeHTML(a.location.name)}</h2><p>${escapeHTML(coordinates(a.location))} · ${escapeHTML(a.created_at)}</p><p>${escapeHTML(a.summary)}</p><h2>Mineral screening</h2>${a.assessments.map((m) => `<section><h3>${escapeHTML(m.commodity)} · ${escapeHTML(m.prospectivity)}</h3><p>Evidence quality: ${escapeHTML(m.evidence_quality)}</p><p>${escapeHTML(m.explanation)}</p></section>`).join("")}<h2>Sources</h2>${a.providers.map((p) => `<p>${escapeHTML(p.source.dataset_name)} — ${escapeHTML(p.status)}<br/>${escapeHTML(p.source.source_url)}</p>`).join("")}<h2>Next steps</h2>${a.next_steps.map((n) => `<p>${escapeHTML(n)}</p>`).join("")}<h2>Limitations</h2>${a.limitations.map((n) => `<p>${escapeHTML(n)}</p>`).join("")}<p>Regional screening only. No reserves, grade, economic value or mineral rights are established. Model: ${escapeHTML(a.model_version)}</p></body></html>`;
      await exportReport(a, html);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header title="Exploration Report" back={back} />
      <ScrollView contentContainerStyle={ui.content}>
        {a ? (
          <>
            <View style={[ui.card, { padding: 24 }]}>
              <View
                style={{
                  backgroundColor: "#EDF3EC",
                  padding: 25,
                  borderRadius: 10,
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    color: colors.green,
                    fontSize: 11,
                    letterSpacing: 2,
                  }}
                >
                  GEOMINERAL
                </Text>
                <Text style={ui.title}>Mineral Potential Report</Text>
                <Text style={ui.body}>{a.location.name}</Text>
                <Text style={ui.small}>
                  {new Date(a.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={ui.body}>{a.summary}</Text>
              <Button title="Export PDF" busy={busy} onPress={download} />
            </View>
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
