import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ChevronRight, FlaskConical, MapPin, Search } from "lucide-react-native";
import { Button, Empty, Header, Row } from "./components/Primitives";
import MineralArt from "./components/MineralArt";
import { RatingPill } from "./ExploreScreens";
import {
  findMineral,
  GROUPS,
  minerals,
  mineralSource,
  pretty,
  searchMinerals,
  sourceName,
  type Mineral,
} from "./minerals";
import { fluorescence, magnetism } from "./identify";
import { FadeIn, Float, haptic, Pressy } from "./motion";
import {
  asMineral,
  colorFor,
  findSpecies,
  habitFor,
  searchSpecies,
  SPECIES_COUNT,
  wikidataUrl,
} from "./species";
import { useWorkspace } from "./state/Workspace";
import { projectsWithCache, saveRecord } from "./services/outbox";
import { type, useTheme } from "./theme";
import type { Project } from "./types";

function Fact({ label, value }: { label: string; value: string }) {
  const { ui } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={ui.caption}>{label}</Text>
      <Text style={ui.h3}>{value}</Text>
    </View>
  );
}

export default function MineralGuide({
  back,
  initialQuery = "",
  signIn,
  explore,
  identify,
}: {
  back: () => void;
  initialQuery?: string;
  signIn: () => void;
  explore: () => void;
  identify: () => void;
}) {
  const w = useWorkspace();
  const { c, ui } = useTheme();
  const exactSpecies = findSpecies(initialQuery);
  const exact =
    findMineral(initialQuery) ?? (exactSpecies ? asMineral(exactSpecies) : undefined);
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
    [saved, setSaved] = useState<"" | "online" | "offline">("");
  function choose(x: Mineral) {
    setSelected(x);
    setProjects(null);
    setError("");
    setSaved("");
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
      setProjects(await projectsWithCache());
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
      const { queued } = await saveRecord(p, {
        kind: "sample",
        title: title.trim(),
        description: `${confirmed ? "Lab-confirmed (user reported)" : "Suspected; not confirmed"} mineral: ${selected.name}. ${notes.trim() || "No additional observations recorded."}${confirmed ? ` Laboratory reference: ${reference.trim()}.` : ""}`,
        location: w.location,
        rock_type: selected.name,
        method: confirmed ? "Lab-confirmed (user reported)" : "Suspected visual identification",
        chain_of_custody: confirmed ? reference.trim() : "Not recorded",
      });
      setSaved(queued ? "offline" : "online");
      setProjects(null);
      w.refreshPending();
      haptic.success();
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
  const more =
    group === "All" ? searchSpecies(query, 25, new Set(minerals.map((m) => m.name.toLowerCase()))) : [];
  return (
    <View style={ui.page}>
      <Header
        title={selected ? selected.name : "Mineral Guide"}
        back={() => (selected ? (setSelected(null), setProjects(null), setError("")) : back())}
      />
      <ScrollView
        key={selected?.name ?? "list"}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={ui.content}
      >
        {!selected ? (
          <>
            <View
              style={[ui.row, { backgroundColor: c.fill, borderRadius: 22, paddingHorizontal: 14, minHeight: 44 }]}
            >
              <Search size={17} color={c.secondary} />
              <TextInput
                accessibilityLabel="Search minerals"
                placeholder={`Search ${SPECIES_COUNT.toLocaleString()} minerals`}
                placeholderTextColor={c.tertiary}
                value={query}
                onChangeText={setQuery}
                style={{ flex: 1, height: 44, ...type.body, color: c.label }}
              />
            </View>
            <Pressy
              accessibilityRole="button"
              accessibilityLabel="Identify by Tests"
              onPress={identify}
              scaleTo={0.98}
              style={[ui.card, ui.row, { gap: 12, paddingVertical: 14 }]}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.tintSoft, alignItems: "center", justifyContent: "center" }}>
                <FlaskConical size={18} color={c.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ui.h3}>Identify by Tests</Text>
                <Text style={ui.small}>Shine, scratch, streak, magnet, UV</Text>
              </View>
              <ChevronRight size={18} color={c.tertiary} />
            </Pressy>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}>
              <View style={[ui.row, { gap: 8, paddingHorizontal: 16 }]}>
                {GROUPS.map((g) => (
                  <Pressy
                    accessibilityRole="button"
                    accessibilityLabel={g}
                    accessibilityState={{ selected: group === g }}
                    key={g}
                    feedback={false}
                    onPress={() => {
                      haptic.select();
                      setGroup(g);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 18,
                      backgroundColor: group === g ? c.tint : c.fill,
                    }}
                  >
                    <Text
                      style={{
                        ...type.subhead,
                        fontWeight: "600",
                        color: group === g ? c.onTint : c.label,
                      }}
                    >
                      {g}
                    </Text>
                  </Pressy>
                ))}
              </View>
            </ScrollView>
            <View key={group + query} style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {results.map((x, i) => (
                <FadeIn key={x.name} index={i} style={{ width: "47.8%" }}>
                  <Pressy
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${x.name} profile`}
                    onPress={() => choose(x)}
                    style={[ui.card, { padding: 12, gap: 8 }]}
                  >
                    <View
                      style={{
                        alignItems: "center",
                        paddingVertical: 12,
                        borderRadius: 16,
                        backgroundColor: x.color + "1F",
                      }}
                    >
                      <MineralArt color={x.color} habit={x.habit} size={60} />
                    </View>
                    <View style={{ paddingHorizontal: 4, gap: 1 }}>
                      <Text style={ui.h3} numberOfLines={1}>
                        {x.name}
                      </Text>
                      <Text style={ui.small} numberOfLines={1}>
                        {x.rock ? x.group.replace(" rocks", "") : pretty(x.formula)}
                      </Text>
                    </View>
                  </Pressy>
                </FadeIn>
              ))}
            </View>
            {!!more.length && (
              <>
                <Text style={ui.section}>All mineral species</Text>
                <View style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
                  {more.map((sp, i) => (
                    <FadeIn key={sp.qid} index={i}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${sp.name} profile`}
                        onPress={() => choose(asMineral(sp))}
                        style={({ pressed }) => [
                          ui.row,
                          { gap: 12, paddingLeft: 14, backgroundColor: pressed ? c.fill : "transparent" },
                        ]}
                      >
                        <MineralArt color={colorFor(sp.name)} habit={habitFor(sp.system)} size={30} />
                        <View
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            paddingRight: 14,
                            borderBottomWidth: i === more.length - 1 ? 0 : 0.5,
                            borderColor: c.separator,
                          }}
                        >
                          <Text style={ui.h3} numberOfLines={1}>
                            {sp.name}
                          </Text>
                          <Text style={ui.small} numberOfLines={1}>
                            {[sp.formula, sp.system].filter(Boolean).join(" · ")}
                          </Text>
                        </View>
                      </Pressable>
                    </FadeIn>
                  ))}
                </View>
              </>
            )}
            {!results.length && !more.length && <Empty title="No matches" description="" />}
          </>
        ) : (
          <View key={selected.name} style={{ gap: 16 }}>
            <FadeIn>
              <View
                style={[
                  ui.card,
                  { alignItems: "center", paddingVertical: 30, backgroundColor: selected.color + "1C", boxShadow: "none" },
                ]}
              >
                <Float>
                  <MineralArt color={selected.color} habit={selected.habit} size={140} />
                </Float>
                <Text style={ui.largeTitle}>{selected.name}</Text>
                <Text style={[ui.body, { textAlign: "center" }]}>
                  {selected.rock ? selected.group : `${selected.species ? selected.formula : pretty(selected.formula)} · ${selected.group}`}
                </Text>
                {!selected.rock && !selected.species && (
                  <Text style={ui.small}>Mohs hardness: {selected.hardness}</Text>
                )}
              </View>
            </FadeIn>
            {!selected.rock && !selected.species && (
              <FadeIn index={1}>
                <View style={[ui.card, { gap: 14 }]}>
                  <View style={[ui.row, { alignItems: "flex-start" }]}>
                    <Fact label="Streak" value={selected.streak} />
                    <Fact label="Lustre" value={selected.luster} />
                  </View>
                  <View style={[ui.row, { alignItems: "flex-start" }]}>
                    <Fact label="Magnet" value={magnetism(selected)} />
                    <Fact label="UV glow" value={fluorescence(selected)} />
                  </View>
                </View>
              </FadeIn>
            )}
            {!!selected.traits && (
            <>
            <FadeIn index={2} style={{ gap: 6, paddingHorizontal: 4 }}>
              <Text style={ui.h2}>Recognition clues</Text>
              <Text style={[ui.text, { color: c.secondary }]}>{selected.traits}</Text>
            </FadeIn>
            <FadeIn index={3} style={{ gap: 6, paddingHorizontal: 4 }}>
              <Text style={ui.h2}>Where it forms</Text>
              <Text style={[ui.text, { color: c.secondary }]}>{selected.setting}</Text>
            </FadeIn>
            </>
            )}
            {!!selected.lookalikes?.length && (
              <FadeIn index={4} style={{ gap: 10, paddingHorizontal: 4 }}>
                <Text style={ui.h2}>Look-alikes</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {selected.lookalikes.map((name) => {
                    const other = findMineral(name);
                    return (
                      <Pressy
                        key={name}
                        accessibilityRole="button"
                        accessibilityLabel={`Compare with ${name}`}
                        disabled={!other}
                        onPress={() => other && choose(other)}
                        style={[
                          ui.row,
                          { gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 18, backgroundColor: c.card },
                        ]}
                      >
                        {other && <MineralArt color={other.color} habit={other.habit} size={22} />}
                        <Text style={{ ...type.subhead, fontWeight: "600", color: c.label }}>{name}</Text>
                      </Pressy>
                    );
                  })}
                </View>
              </FadeIn>
            )}
            {nearby && (
              <FadeIn index={5}>
                <Pressy accessibilityRole="button" onPress={explore} style={[ui.card, ui.between]}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={[ui.row, { gap: 6 }]}>
                      <MapPin size={14} color={c.tint} />
                      <Text style={ui.small} numberOfLines={1}>
                        {w.location.name}
                      </Text>
                    </View>
                    <RatingPill rating={nearby.prospectivity} />
                    <Text style={ui.body}>{nearby.explanation}</Text>
                  </View>
                  <ChevronRight size={18} color={c.tertiary} />
                </Pressy>
              </FadeIn>
            )}
            <View style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
              {!!selected.species && (
                <Row
                  title="Wikidata"
                  onPress={() => void Linking.openURL(wikidataUrl(selected.species!.qid))}
                />
              )}
              <Row
                title={sourceName(selected)}
                last
                onPress={() =>
                  void Linking.openURL(mineralSource(selected)).catch(() =>
                    setError("Could not open the source."),
                  )
                }
              />
            </View>
            {saved ? (
              <Text style={[ui.h3, { color: c.tint, textAlign: "center" }]}>
                {saved === "offline" ? "Saved offline. Syncs when you're back online." : "Saved."}
              </Text>
            ) : (
              <Button title="Add Sample" busy={busy} onPress={prepare} />
            )}
            {projects && (
              <FadeIn>
                <View style={[ui.card, { gap: 12 }]}>
                  <Text style={ui.h3}>Sample record</Text>
                  <TextInput
                    accessibilityLabel="Mineral sample title"
                    value={title}
                    onChangeText={setTitle}
                    style={ui.field}
                  />
                  <TextInput
                    accessibilityLabel="Mineral sample notes"
                    placeholder="Notes"
                    placeholderTextColor={c.tertiary}
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
                        onPress={() => {
                          haptic.select();
                          setConfirmed(i === 1);
                        }}
                        key={v}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 14,
                          borderRadius: 18,
                          backgroundColor: confirmed === (i === 1) ? c.tint : c.fill,
                        }}
                      >
                        <Text
                          style={{
                            ...type.subhead,
                            fontWeight: "600",
                            color: confirmed === (i === 1) ? c.onTint : c.label,
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
                      placeholderTextColor={c.tertiary}
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
              </FadeIn>
            )}
          </View>
        )}
        {!!error && <Text style={ui.error}>{error}</Text>}
      </ScrollView>
    </View>
  );
}
