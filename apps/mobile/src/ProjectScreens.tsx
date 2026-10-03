import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Camera, ChevronRight, CloudUpload, FolderOpen, Pencil, Plus, Trash2, UserRound } from "lucide-react-native";
import NativeMap from "./components/NativeMap";
import { VoicePlayer } from "./components/VoiceNote";
import MineralArt from "./components/MineralArt";
import { Brand, Button, Empty, Header, Row } from "./components/Primitives";
import { findMineral } from "./minerals";
import { FadeIn, haptic, Pressy, Segmented } from "./motion";
import Rockdex from "./Rockdex";
import { api, coordinates } from "./services/api";
import { useWorkspace } from "./state/Workspace";
import { type, useTheme } from "./theme";
import type { Project } from "./types";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Destructive actions need a second tap within a few seconds. */
const useArmed = () => {
  const [armed, setArmed] = useState("");
  const confirm = (key: string, run: () => void) => {
    if (armed === key) {
      setArmed("");
      haptic.heavy();
      run();
    } else {
      haptic.warning();
      setArmed(key);
      setTimeout(() => setArmed((k) => (k === key ? "" : k)), 3500);
    }
  };
  return { armed, confirm };
};

export function ProjectsList({
  projects,
  busy,
  error,
  signIn,
  create,
  open,
  guide,
}: {
  guide: (name: string) => void;
  projects: Project[];
  busy: boolean;
  error: string;
  signIn: () => void;
  create: () => void;
  open: (p: Project) => void;
}) {
  const w = useWorkspace();
  const { c, ui } = useTheme();
  const [view, setView] = useState<"Projects" | "Rockdex">("Projects");
  return (
    <View style={ui.page}>
      <Header
        large
        title={view}
        right={
          w.user && view === "Projects" ? (
            <Pressy
              accessibilityRole="button"
              accessibilityLabel="Create project"
              onPress={create}
              style={[s.round, { backgroundColor: c.fill }]}
            >
              <Plus size={20} color={c.tint} strokeWidth={2.6} />
            </Pressy>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={ui.content}>
        <Segmented items={["Projects", "Rockdex"] as const} value={view} onChange={setView} />
        {w.pendingCount > 0 && (
          <FadeIn>
            <Pressy
              accessibilityRole="button"
              accessibilityLabel="Sync now"
              onPress={() => void w.sync()}
              style={[ui.row, { gap: 10, padding: 12, borderRadius: 16, backgroundColor: c.tintSoft }]}
            >
              <CloudUpload size={18} color={c.tint} />
              <Text style={{ ...type.subhead, fontWeight: "600", color: c.tint, flex: 1 }}>
                {w.pendingCount} {w.pendingCount === 1 ? "sample" : "samples"} waiting to sync
              </Text>
              <Text style={{ ...type.footnote, color: c.tint }}>Sync</Text>
            </Pressy>
          </FadeIn>
        )}
        {view === "Rockdex" ? (
          <Rockdex open={guide} signIn={signIn} />
        ) : (
        <>
        {!!error && <Text style={ui.error}>{error}</Text>}
        {busy && !projects.length && <ActivityIndicator color={c.tint} />}
        {!w.user ? (
          <Empty title="Your projects" description="Sign in to save places, samples and notes.">
            <Button title="Sign In" onPress={signIn} />
          </Empty>
        ) : !projects.length && !busy ? (
          <Empty title="No projects yet" description="">
            <Button title="Create Project" onPress={create} />
          </Empty>
        ) : (
          projects.map((p, i) => (
            <FadeIn key={p.id} index={i}>
              <Pressy
                accessibilityRole="button"
                accessibilityLabel={p.name}
                scaleTo={0.97}
                onPress={() => open(p)}
                style={[ui.card, ui.row, { gap: 14 }]}
              >
                <View style={[s.art, { backgroundColor: c.tintSoft }]}>
                  <FolderOpen size={24} color={c.tint} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={ui.h3} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={ui.small} numberOfLines={1}>
                    {p.location.name}
                  </Text>
                  <Text style={[ui.caption, { color: c.tint, fontWeight: "600" }]}>
                    {p.record_count ?? 0} {p.record_count === 1 ? "sample" : "samples"} · {day(p.created_at)}
                  </Text>
                </View>
                <ChevronRight size={18} color={c.tertiary} />
              </Pressy>
            </FadeIn>
          ))
        )}
        </>
        )}
      </ScrollView>
    </View>
  );
}

export function ProjectDetail({
  project,
  setProject,
  back,
  guide,
  analyze,
  addSample,
  deleted,
}: {
  project: Project;
  setProject: (p: Project) => void;
  back: () => void;
  guide: (q?: string) => void;
  analyze: () => void;
  addSample: () => void;
  deleted: () => void;
}) {
  const { c, ui } = useTheme();
  const { armed, confirm } = useArmed();
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(project.name),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function rename() {
    if (!name.trim() || name.trim() === project.name) return setEditing(false);
    setBusy(true);
    setError("");
    try {
      const p = await api<Project>(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      setProject({ ...project, name: p.name });
      setEditing(false);
      haptic.success();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api(`/projects/${project.id}`, { method: "DELETE" });
      deleted();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function removeRecord(id: string) {
    try {
      await api(`/projects/${project.id}/records/${id}`, { method: "DELETE" });
      setProject({ ...project, records: project.records?.filter((r) => r.id !== id) });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <View style={ui.page}>
      <Header
        title={project.name}
        back={back}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rename project"
            onPress={() => setEditing(!editing)}
            hitSlop={10}
          >
            <Pencil size={19} color={c.tint} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {editing && (
          <FadeIn style={[ui.row, { gap: 8 }]}>
            <TextInput
              accessibilityLabel="Project name"
              value={name}
              onChangeText={setName}
              autoFocus
              onSubmitEditing={rename}
              style={[ui.field, { flex: 1 }]}
            />
            <Button title="Save" busy={busy} onPress={rename} />
          </FadeIn>
        )}
        <FadeIn>
          <View style={[s.map, { backgroundColor: c.hero }]}>
            <NativeMap
              location={project.location}
              satellite
              polygon={(project.polygon ?? []).slice(0, -1)}
              drawing={false}
              interactive={false}
              onSelect={() => {}}
            />
          </View>
        </FadeIn>
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <Text style={ui.h2}>{project.location.name}</Text>
          <Text style={ui.small}>
            {coordinates(project.location)}
            {project.area_m2 ? ` · ${(project.area_m2 / 1e6).toFixed(2)} km²` : ""}
          </Text>
        </View>
        <View style={[ui.row, { gap: 10 }]}>
          <Button style={{ flex: 1 }} title="Analyze" onPress={analyze} />
          <Button
            style={{ flex: 1 }}
            outline
            title="Add Sample"
            icon={<Camera size={18} color={c.tint} />}
            onPress={addSample}
          />
        </View>
        <Text style={ui.section}>
          Samples{project.records?.length ? ` · ${project.records.length}` : ""}
        </Text>
        {project.records?.map((r, i) => {
          const known = r.rock_type ? findMineral(r.rock_type) : undefined;
          return (
            <FadeIn key={r.id} index={i}>
              <View style={[ui.card, { gap: 10 }]}>
                {!!r.photos?.length && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {r.photos.map((photo, j) => (
                      <Image
                        key={j}
                        accessibilityLabel={`Sample photo ${j + 1}`}
                        source={{ uri: photo }}
                        style={s.photo}
                      />
                    ))}
                  </ScrollView>
                )}
                <View style={ui.between}>
                  <Text style={[ui.h3, { flex: 1 }]}>{r.title}</Text>
                  <Text style={ui.caption}>{day(r.created_at)}</Text>
                </View>
                {!!r.rock_type && r.rock_type !== "Unidentified" && (
                  <Pressy
                    accessibilityRole="button"
                    accessibilityLabel={`About ${r.rock_type}`}
                    onPress={() => guide(r.rock_type!)}
                    style={[s.chip, { backgroundColor: c.tintSoft }]}
                  >
                    {known && <MineralArt color={known.color} habit={known.habit} size={20} />}
                    <Text style={{ ...type.subhead, fontWeight: "600", color: c.label }}>{r.rock_type}</Text>
                    <ChevronRight size={14} color={c.secondary} />
                  </Pressy>
                )}
                {!!r.audio && <VoicePlayer uri={r.audio} />}
                <Text style={ui.body}>{r.description}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${r.title}`}
                  onPress={() => confirm(r.id, () => void removeRecord(r.id))}
                  hitSlop={8}
                  style={[ui.row, { gap: 6, alignSelf: "flex-start" }]}
                >
                  <Trash2 size={14} color={armed === r.id ? c.danger : c.tertiary} />
                  <Text style={[ui.small, armed === r.id && { color: c.danger, fontWeight: "600" }]}>
                    {armed === r.id ? "Tap again to delete" : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </FadeIn>
          );
        })}
        {!project.records?.length && <Empty title="No samples yet" description="" />}
        {!!error && <Text style={ui.error}>{error}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete project"
          onPress={() => confirm("project", () => void remove())}
          style={[ui.card, { alignItems: "center", paddingVertical: 14 }]}
        >
          {busy ? (
            <ActivityIndicator color={c.danger} />
          ) : (
            <Text style={{ ...type.body, color: c.danger, fontWeight: armed === "project" ? "600" : "400" }}>
              {armed === "project" ? "Tap again to delete project" : "Delete Project"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function Profile({
  signIn,
  signOut,
  error,
}: {
  signIn: () => void;
  signOut: () => void;
  error: string;
}) {
  const w = useWorkspace();
  const { c, ui } = useTheme();
  return (
    <View style={ui.page}>
      <Header large title="Profile" />
      <ScrollView contentContainerStyle={ui.content}>
        <FadeIn>
          <View style={[ui.card, { alignItems: "center", paddingVertical: 26, gap: 10 }]}>
            <View style={[s.avatar, { backgroundColor: c.tintSoft }]}>
              <UserRound color={c.tint} size={30} />
            </View>
            <Text style={ui.h2}>{w.user ? w.user.email : "Guest"}</Text>
            {!w.user && (
              <Button style={{ alignSelf: "stretch" }} title="Sign In / Create Account" onPress={signIn} />
            )}
          </View>
        </FadeIn>
        <View style={[ui.card, ui.between, { paddingVertical: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={ui.text}>Professional detail</Text>
            <Text style={ui.small}>Map references and evidence IDs</Text>
          </View>
          <Switch
            accessibilityLabel="Professional detail"
            value={w.professional}
            onValueChange={(v) => {
              haptic.select();
              w.setProfessional(v);
            }}
            trackColor={{ true: c.tint }}
          />
        </View>
        <Text style={ui.section}>Data sources</Text>
        <View style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
          {[
            ["Macrostrat", "https://macrostrat.org"],
            ["USGS Mineral Resources", "https://mrdata.usgs.gov/mrds/"],
            ["OpenStreetMap", "https://www.openstreetmap.org/copyright"],
          ].map(([label, url], i) => (
            <Row key={label} title={label} last={i === 2} onPress={() => void Linking.openURL(url)} />
          ))}
        </View>
        <View style={{ alignItems: "center", gap: 6, paddingVertical: 10 }}>
          <Brand />
          <Text style={ui.caption}>Ratings are screening signals, not deposits.</Text>
          <Text style={ui.caption}>Earth image: NASA / JPL</Text>
        </View>
        {!!error && <Text style={ui.error}>{error}</Text>}
        {w.user && <Button outline title="Sign Out" onPress={signOut} />}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  round: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  art: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  map: { height: 190, borderRadius: 26, overflow: "hidden" },
  photo: { width: 150, height: 150, borderRadius: 16, marginRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
});
