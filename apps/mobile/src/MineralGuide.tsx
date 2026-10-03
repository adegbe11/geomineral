import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChevronRight, MapPin } from "lucide-react-native";
import { Button, Empty, Header } from "./components/Primitives";
import MineralArt from "./components/MineralArt";
import { RatingPill } from "./ExploreScreens";
import {
  findMineral,
  GROUPS,
  minerals,
  mineralSource,
  searchMinerals,
  sourceName,
  type Mineral,
} from "./minerals";
import { useWorkspace } from "./state/Workspace";
import { api, post } from "./services/api";
import { colors, ui } from "./theme";
import type { Project } from "./types";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={ui.small}>{label}</Text>
      <Text style={[ui.h3, { fontSize: 14 }]}>{value}</Text>
    </View>
  );
}

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
  const exact = findMineral(initialQuery);
  const [query, setQuery] = useState(exact ? "" : initialQuery),
    [group, setGroup] = useState("All"),
    [selected, setSelected] = useState<Mineral | null>(exact ?? null),
    [projects, setProjects] = useState<Project[] | null>(null),
    [title, setTitle] = useState(exact ? `${exact.name} field sample` : ""),
    [notes, setNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [reference, setReference] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  function choose(x: Mineral) {
    setSelected(x);
    setProjects(null);
    setError("");
    setSaved(false);
    setTitle(`${x.name} field sample`);
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
  const nearby = selected?.commodity
    ? w.analysis?.assessments.find(
        (a) =>
          a.commodity.toLowerCase() === selected.commodity.toLowerCase() &&
          a.prospectivity !== "Insufficient evidence",
      )
    : undefined;
  const results = searchMinerals(query, group);
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
            <TextInput
              accessibilityLabel="Search minerals"
              placeholder={`Search ${minerals.length} minerals and rocks`}
              placeholderTextColor="#9098A5"
              value={query}
              onChangeText={setQuery}
              style={ui.field}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[ui.row, { gap: 8 }]}>
                {GROUPS.map((g) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: group === g }}
                    key={g}
                    onPress={() => setGroup(g)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: group === g ? colors.green : "#E4EADF",
                    }}
                  >
                    <Text
                      style={{
                        color: group === g ? "#fff" : colors.ink,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {g}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {results.map((x) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${x.name} profile`}
                  key={x.name}
                  onPress={() => choose(x)}
                  style={({ pressed }) => [
                    ui.card,
                    {
                      width: "47.5%",
                      padding: 14,
                      gap: 6,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={{
                      alignItems: "center",
                      paddingVertical: 8,
                      borderRadius: 16,
                      backgroundColor: x.color + "1A",
                    }}
                  >
                    <MineralArt color={x.color} habit={x.habit} size={64} />
                  </View>
                  <Text style={ui.h3} numberOfLines={1}>
                    {x.name}
                  </Text>
                  <Text style={ui.small} numberOfLines={1}>
                    {x.rock ? x.group.replace(" rocks", "") : x.formula}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!results.length && <Empty title="No matches" description="" />}
          </>
        ) : (
          <>
            <View
              style={[
                ui.card,
                {
                  alignItems: "center",
                  padding: 28,
                  backgroundColor: selected.color + "14",
                  borderColor: selected.color + "33",
                },
              ]}
            >
              <MineralArt color={selected.color} habit={selected.habit} size={130} />
              <Text style={ui.title}>{selected.name}</Text>
              <Text style={ui.body}>
                {selected.rock ? selected.group : `${selected.formula} · ${selected.group}`}
              </Text>
              {!selected.rock && (
                <Text style={ui.small}>Mohs hardness: {selected.hardness}</Text>
              )}
            </View>
            {!selected.rock && (
              <View style={[ui.card, ui.row, { alignItems: "flex-start" }]}>
                <Fact label="Streak" value={selected.streak} />
                <Fact label="Lustre" value={selected.luster} />
              </View>
            )}
            <View style={{ gap: 8 }}>
              <Text style={ui.h2}>Recognition clues</Text>
              <Text style={ui.body}>{selected.traits}</Text>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={ui.h2}>Where it forms</Text>
              <Text style={ui.body}>{selected.setting}</Text>
            </View>
            {!!selected.lookalikes?.length && (
              <View style={{ gap: 10 }}>
                <Text style={ui.h2}>Look-alikes</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {selected.lookalikes.map((name) => {
                    const other = findMineral(name);
                    return (
                      <Pressable
                        key={name}
                        accessibilityRole="button"
                        accessibilityLabel={`Compare with ${name}`}
                        disabled={!other}
                        onPress={() => other && choose(other)}
                        style={[
                          ui.row,
                          {
                            gap: 6,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 18,
                            backgroundColor: "#fff",
                            borderWidth: 1,
                            borderColor: colors.line,
                          },
                        ]}
                      >
                        {other && (
                          <MineralArt color={other.color} habit={other.habit} size={20} />
                        )}
                        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.ink }}>
                          {name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {nearby && (
              <Pressable
                accessibilityRole="button"
                onPress={explore}
                style={[ui.card, ui.between]}
              >
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={[ui.row, { gap: 6 }]}>
                    <MapPin size={14} color={colors.green} />
                    <Text style={ui.small} numberOfLines={1}>
                      {w.location.name}
                    </Text>
                  </View>
                  <RatingPill rating={nearby.prospectivity} />
                  <Text style={ui.body}>{nearby.explanation}</Text>
                </View>
                <ChevronRight size={18} color={colors.muted} />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                void Linking.openURL(mineralSource(selected)).catch(() =>
                  setError("Could not open the source."),
                )
              }
              style={[ui.card, ui.between]}
            >
              <Text style={ui.h3}>{sourceName(selected)}</Text>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
            {saved ? (
              <Text style={[ui.h3, { color: colors.green, textAlign: "center" }]}>
                Saved.
              </Text>
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
                  placeholderTextColor="#9098A5"
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
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 18,
                        backgroundColor:
                          confirmed === (i === 1) ? colors.green : "#EEF1EC",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: confirmed === (i === 1) ? "#fff" : colors.ink,
                        }}
                      >
                        {v}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {confirmed && (
                  <TextInput
                    accessibilityLabel="Laboratory reference"
                    placeholder="Lab name and report reference"
                    placeholderTextColor="#9098A5"
                    value={reference}
                    onChangeText={setReference}
                    style={ui.field}
                  />
                )}
                {!projects.length && <Text style={ui.body}>No projects yet.</Text>}
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
