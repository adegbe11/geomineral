import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Header, MineralArt, Notice } from "./components/Primitives";
import {
  minerals,
  mineralSource,
  searchMinerals,
  type Mineral,
} from "./minerals";
import { useWorkspace } from "./state/Workspace";
import { api, post, coordinates } from "./services/api";
import { colors, ui } from "./theme";
import type { Project } from "./types";
export default function MineralGuide({
  back,
  initialQuery = "",
  signIn,
  explore,
}: {
  back: () => void;
  initialQuery?: string;
  signIn: () => void;
  explore: () => void;
}) {
  const w = useWorkspace();
  const [query, setQuery] = useState(initialQuery),
    [group, setGroup] = useState("All"),
    [selected, setSelected] = useState<Mineral | null>(
      minerals.find(
        (m) => m.name.toLowerCase() === initialQuery.toLowerCase(),
      ) || null,
    ),
    [projects, setProjects] = useState<Project[] | null>(null),
    [title, setTitle] = useState(""),
    [notes, setNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [reference, setReference] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  function choose(m: Mineral) {
    setSelected(m);
    setProjects(null);
    setError("");
    setSaved(false);
    setTitle(`${m.name} field sample`);
    setNotes("");
    setConfirmed(false);
    setReference("");
  }
  async function prepare() {
    if (!w.user) {
      signIn();
      return;
    }
    setBusy(true);
    setError("");
    if (!title) setTitle(`${selected?.name} field sample`);
    try {
      setProjects(await api<Project[]>("/projects"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(p: Project) {
    if (!selected || !title.trim() || (confirmed && !reference.trim())) return;
    setBusy(true);
    setError("");
    try {
      await post(`/projects/${p.id}/records`, {
        kind: "sample",
        title: title.trim(),
        description: `${confirmed ? "Lab-confirmed (user reported)" : "Suspected; not confirmed"} mineral: ${selected.name}. ${notes.trim() || "No additional observations recorded."}${confirmed ? ` Laboratory reference: ${reference.trim()}.` : ""}`,
        location: w.location,
        rock_type: selected.name,
        method: confirmed
          ? "Lab-confirmed (user reported)"
          : "Suspected visual identification",
        chain_of_custody: confirmed ? reference.trim() : "Not recorded",
      });
      setSaved(true);
      setProjects(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const related = selected
    ? w.analysis?.assessments.filter(
        (a) => a.commodity.toLowerCase() === selected.commodity,
      )
    : [];
  return (
    <>
      <Header
        title={selected ? selected.name : "Mineral Guide"}
        back={() =>
          selected
            ? (setSelected(null), setProjects(null), setError(""))
            : back()
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={ui.content}
      >
        {!selected ? (
          <>
            <Text style={ui.body}>{minerals.length} minerals</Text>
            <TextInput
              accessibilityLabel="Search minerals"
              placeholder="Name, formula or mineral group"
              value={query}
              onChangeText={setQuery}
              style={ui.field}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={ui.row}>
                {["All", ...new Set(minerals.map((m) => m.group))].map((g) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: group === g }}
                    key={g}
                    onPress={() => setGroup(g)}
                    style={{
                      padding: 12,
                      borderRadius: 22,
                      backgroundColor: group === g ? colors.green : "#E4EADF",
                    }}
                  >
                    <Text
                      style={{
                        color: group === g ? "#fff" : colors.ink,
                        fontSize: 12,
                      }}
                    >
                      {g}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            {searchMinerals(query, group).map((m) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${m.name} profile`}
                key={m.name}
                onPress={() => choose(m)}
                style={[ui.card, ui.row]}
              >
                <MineralArt color={m.color} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={ui.h2}>{m.name}</Text>
                  <Text style={ui.small}>
                    {m.formula} / {m.group}
                  </Text>
                </View>
                <Text style={{ color: colors.green }}>→</Text>
              </Pressable>
            ))}
            {!searchMinerals(query, group).length && (
              <Notice>No matches.</Notice>
            )}
          </>
        ) : (
          <>
            <View style={[ui.card, { alignItems: "center", padding: 30 }]}>
              <MineralArt color={selected.color} size={110} />
              <Text style={ui.title}>{selected.name}</Text>
              <Text style={ui.body}>
                {selected.formula} / {selected.group}
              </Text>
              <Text style={ui.small}>Mohs hardness: {selected.hardness}</Text>
            </View>
            <Text style={ui.h2}>Recognition clues</Text>
            <Text style={ui.body}>{selected.traits}</Text>
            <Text style={ui.h2}>Geological setting</Text>
            <Text style={ui.body}>{selected.setting}</Text>
            <Button
              outline
              title="Source"
              onPress={() =>
                void Linking.openURL(mineralSource(selected)).catch(() =>
                  setError("Could not open the source."),
                )
              }
            />
            <Text style={ui.small}>
              Handbook of Mineralogy · Illustrated profiles
            </Text>
            <Text style={ui.h2}>Location</Text>
            <Text style={ui.body}>
              {w.location.name} / {coordinates(w.location)}
            </Text>
            {related?.length ? (
              related.map((a) => (
                <Notice key={a.commodity}>
                  {a.commodity}: {a.prospectivity}. {a.explanation} This
                  commodity-level assessment does not confirm this mineral
                  species.
                </Notice>
              ))
            ) : (
              <Notice>No local evidence available.</Notice>
            )}
            <Button outline title="View on Map" onPress={explore} />
            <Notice>Identification unconfirmed.</Notice>
            {saved ? (
              <Notice>Saved.</Notice>
            ) : (
              <Button title="Add Sample" busy={busy} onPress={prepare} />
            )}
            {projects && (
              <View style={ui.card}>
                <Text style={ui.h2}>Sample record</Text>
                <TextInput
                  accessibilityLabel="Mineral sample title"
                  value={title}
                  onChangeText={setTitle}
                  style={ui.field}
                />
                <TextInput
                  accessibilityLabel="Mineral sample notes"
                  placeholder="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  style={ui.field}
                />
                <View style={ui.row}>
                  {["Suspected", "Lab-confirmed"].map((v, i) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: confirmed === (i === 1) }}
                      onPress={() => setConfirmed(i === 1)}
                      key={v}
                      style={{
                        padding: 12,
                        borderRadius: 18,
                        backgroundColor:
                          confirmed === (i === 1) ? colors.pale : "#F5F5F5",
                      }}
                    >
                      <Text>{v}</Text>
                    </Pressable>
                  ))}
                </View>
                {confirmed && (
                  <Text style={ui.small}>
                    User-reported. Lab reference required.
                  </Text>
                )}
                {confirmed && (
                  <TextInput
                    accessibilityLabel="Laboratory reference"
                    placeholder="Lab name and report/sample reference (required)"
                    value={reference}
                    onChangeText={setReference}
                    style={ui.field}
                  />
                )}

                {!projects.length && <Notice>No projects yet.</Notice>}
                {projects.map((p) => (
                  <Button
                    key={p.id}
                    title={`Save to ${p.name}`}
                    busy={busy}
                    disabled={!title.trim() || (confirmed && !reference.trim())}
                    onPress={() => save(p)}
                  />
                ))}
              </View>
            )}
          </>
        )}
        {!!error && <Text style={ui.error}>{error}</Text>}
      </ScrollView>
    </>
  );
}
