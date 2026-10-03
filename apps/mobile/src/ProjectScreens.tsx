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
import {
  Camera,
  ChevronRight,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react-native";
import NativeMap from "./components/NativeMap";
import MineralArt from "./components/MineralArt";
import { Brand, Button, Empty, Header } from "./components/Primitives";
import { findMineral } from "./minerals";
import { api, coordinates } from "./services/api";
import { useWorkspace } from "./state/Workspace";
import { colors, ui } from "./theme";
import type { Project } from "./types";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Destructive actions need a second tap within a few seconds. */
const useArmed = () => {
  const [armed, setArmed] = useState("");
  const confirm = (key: string, run: () => void) => {
    if (armed === key) {
      setArmed("");
      run();
    } else {
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
}: {
  projects: Project[];
  busy: boolean;
  error: string;
  signIn: () => void;
  create: () => void;
  open: (p: Project) => void;
}) {
  const w = useWorkspace();
  return (
    <>
      <Header
        title="My Projects"
        right={
          w.user ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create project"
              onPress={create}
              hitSlop={10}
            >
              <Plus size={24} color={colors.green} />
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={ui.content}>
        {!!error && <Text style={ui.error}>{error}</Text>}
        {busy && !projects.length && <ActivityIndicator color={colors.green} />}
        {!w.user ? (
          <Empty title="Your projects" description="Sign in to save places, samples and notes.">
            <Button title="Sign In" onPress={signIn} />
          </Empty>
        ) : !projects.length && !busy ? (
          <Empty title="No projects yet" description="">
            <Button title="Create Project" onPress={create} />
          </Empty>
        ) : (
          projects.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={p.name}
              style={({ pressed }) => [
                ui.card,
                ui.row,
                { gap: 14, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
              onPress={() => open(p)}
            >
              <View style={s.projectArt}>
                <FolderOpen size={26} color="#CFE2C0" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={ui.h3} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={ui.small} numberOfLines={1}>
                  {p.location.name}
                </Text>
                <Text style={[ui.small, { color: colors.green, fontWeight: "600" }]}>
                  {p.record_count ?? 0} {p.record_count === 1 ? "sample" : "samples"} ·{" "}
                  {day(p.created_at)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </>
  );
}

export function ProjectDetail({
  project,
  setProject,
  back,
  guide,
  analyze,
  deleted,
}: {
  project: Project;
  setProject: (p: Project) => void;
  back: () => void;
  guide: (q?: string) => void;
  analyze: () => void;
  deleted: () => void;
}) {
  const w = useWorkspace();
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
      setProject({
        ...project,
        records: project.records?.filter((r) => r.id !== id),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
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
            <Pencil size={19} color={colors.green} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={ui.content}>
        {editing && (
          <View style={[ui.row, { gap: 8 }]}>
            <TextInput
              accessibilityLabel="Project name"
              value={name}
              onChangeText={setName}
              autoFocus
              onSubmitEditing={rename}
              style={[ui.field, { flex: 1 }]}
            />
            <Button title="Save" busy={busy} onPress={rename} />
          </View>
        )}
        <View style={s.map}>
          <NativeMap
            location={project.location}
            satellite
            polygon={(project.polygon ?? []).slice(0, -1)}
            drawing={false}
            interactive={false}
            onSelect={() => {}}
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={ui.h2}>{project.location.name}</Text>
          <Text style={ui.small}>
            {coordinates(project.location)}
            {project.area_m2 ? ` · ${(project.area_m2 / 1e6).toFixed(2)} km²` : ""}
          </Text>
        </View>
        <View style={[ui.row, { gap: 10 }]}>
          <Button
            style={{ flex: 1 }}
            title="Analyze"
            onPress={() => {
              w.selectLocation(project.location);
              analyze();
            }}
          />
          <Button
            style={{ flex: 1 }}
            outline
            title="Add Sample"
            icon={<Camera size={17} color={colors.green} />}
            onPress={() => {
              w.selectLocation(project.location);
              back();
              w.setTab("Scan");
            }}
          />
        </View>
        <Text style={ui.h2}>
          Samples{project.records?.length ? ` · ${project.records.length}` : ""}
        </Text>
        {project.records?.map((r) => {
          const known = r.rock_type ? findMineral(r.rock_type) : undefined;
          return (
            <View style={[ui.card, { gap: 10 }]} key={r.id}>
              {!!r.photos?.length && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {r.photos.map((photo, i) => (
                    <Image
                      key={i}
                      accessibilityLabel={`Sample photo ${i + 1}`}
                      source={{ uri: photo }}
                      style={s.photo}
                    />
                  ))}
                </ScrollView>
              )}
              <View style={ui.between}>
                <Text style={[ui.h3, { flex: 1 }]}>{r.title}</Text>
                <Text style={ui.small}>{day(r.created_at)}</Text>
              </View>
              {!!r.rock_type && r.rock_type !== "Unidentified" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`About ${r.rock_type}`}
                  onPress={() => guide(r.rock_type!)}
                  style={s.chip}
                >
                  {known && <MineralArt color={known.color} habit={known.habit} size={20} />}
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.ink }}>
                    {r.rock_type}
                  </Text>
                  <ChevronRight size={14} color={colors.muted} />
                </Pressable>
              )}
              <Text style={ui.body}>{r.description}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${r.title}`}
                onPress={() => confirm(r.id, () => void removeRecord(r.id))}
                hitSlop={8}
                style={[ui.row, { gap: 6, alignSelf: "flex-start" }]}
              >
                <Trash2 size={14} color={armed === r.id ? "#B4442F" : colors.muted} />
                <Text style={[ui.small, armed === r.id && { color: "#B4442F" }]}>
                  {armed === r.id ? "Tap again to delete" : "Delete"}
                </Text>
              </Pressable>
            </View>
          );
        })}
        {!project.records?.length && <Empty title="No samples yet" description="" />}
        {!!error && <Text style={ui.error}>{error}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete project"
          onPress={() => confirm("project", () => void remove())}
          style={[ui.row, { justifyContent: "center", padding: 14 }]}
        >
          {busy ? (
            <ActivityIndicator color="#B4442F" />
          ) : (
            <Text style={{ color: "#B4442F", fontWeight: "600", fontSize: 13 }}>
              {armed === "project" ? "Tap again to delete project" : "Delete Project"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </>
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
  return (
    <>
      <Header title="Profile" />
      <ScrollView contentContainerStyle={ui.content}>
        <View style={[ui.card, { alignItems: "center", padding: 28 }]}>
          <View style={s.avatar}>
            <UserRound color={colors.green} />
          </View>
          <Text style={ui.h2}>{w.user ? w.user.email : "Guest"}</Text>
          {!w.user && (
            <Button title="Sign In / Create Account" onPress={signIn} />
          )}
        </View>
        <View style={[ui.card, ui.between]}>
          <View style={{ flex: 1 }}>
            <Text style={ui.h3}>Professional detail</Text>
            <Text style={ui.small}>Map references and evidence IDs</Text>
          </View>
          <Switch
            accessibilityLabel="Professional detail"
            value={w.professional}
            onValueChange={w.setProfessional}
            trackColor={{ true: colors.green }}
          />
        </View>
        <View style={[ui.card, { gap: 14 }]}>
          {[
            ["Macrostrat geological maps", "https://macrostrat.org"],
            ["USGS Mineral Resources Data System", "https://mrdata.usgs.gov/mrds/"],
            ["OpenStreetMap place search", "https://www.openstreetmap.org/copyright"],
          ].map(([label, url]) => (
            <Pressable
              key={label}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(url)}
              style={ui.between}
            >
              <Text style={[ui.body, { color: colors.ink }]}>{label}</Text>
              <ChevronRight size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>
        <View style={{ alignItems: "center", gap: 6, paddingVertical: 8 }}>
          <Brand />
          <Text style={ui.small}>Ratings are screening signals, not deposits.</Text>
          <Text style={ui.small}>Earth image: NASA / JPL</Text>
        </View>
        {!!error && <Text style={ui.error}>{error}</Text>}
        {w.user && <Button outline title="Sign Out" onPress={signOut} />}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  projectArt: {
    backgroundColor: "#24503B",
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  map: {
    height: 190,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.dark,
  },
  photo: { width: 150, height: 150, borderRadius: 16, marginRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.pale,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.pale,
    alignItems: "center",
    justifyContent: "center",
  },
});
