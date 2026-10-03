import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronRight, Sparkles } from "lucide-react-native";
import { Empty, Header, MineralArt } from "./components/Primitives";
import { narrow, STREAKS, type Answers } from "./identify";
import { pretty } from "./minerals";
import { CountUp, FadeIn, haptic, Pressy } from "./motion";
import { type, useTheme } from "./theme";

type Question<K extends keyof Answers> = {
  key: K;
  title: string;
  hint: string;
  options: NonNullable<Answers[K]>[];
};
const QUESTIONS: Question<keyof Answers>[] = [
  { key: "shine", title: "Shine", hint: "Like metal, or like glass, wax or earth?", options: ["Metallic", "Not metallic"] },
  {
    key: "scratch",
    title: "Softest thing that scratches it",
    hint: "Try a fingernail, then a copper coin, then a steel knife.",
    options: ["Fingernail", "Coin", "Steel", "Nothing"],
  },
  { key: "streak", title: "Streak", hint: "Rub it on the back of a white tile.", options: STREAKS.map(([s]) => s) },
  { key: "magnet", title: "Magnet", hint: "Does a fridge magnet pull on it?", options: ["Pulls", "No pull"] },
  { key: "uv", title: "UV light", hint: "Under a UV torch in the dark.", options: ["Glows", "No glow"] },
];

export default function IdentifyScreen({
  back,
  suggested = [],
  open,
}: {
  back: () => void;
  suggested?: string[];
  open: (name: string) => void;
}) {
  const { c, ui } = useTheme();
  const [a, setA] = useState<Answers>({});
  const results = narrow(a, suggested);
  const answered = Object.values(a).filter(Boolean).length;
  const set = (key: keyof Answers, value: string) => {
    haptic.select();
    setA((old) => ({ ...old, [key]: old[key] === value ? undefined : value }));
  };
  return (
    <View style={ui.page}>
      <Header
        title="Identify"
        back={back}
        right={
          answered ? (
            <Pressable accessibilityRole="button" onPress={() => setA({})} hitSlop={10}>
              <Text style={{ ...type.body, color: c.tint }}>Reset</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={ui.content}>
        {!!suggested.length && (
          <FadeIn>
            <View style={[ui.row, { gap: 6, paddingHorizontal: 4 }]}>
              <Sparkles size={15} color={c.tint} />
              <Text style={ui.small}>Scan suggested {suggested.join(", ")}</Text>
            </View>
          </FadeIn>
        )}
        {QUESTIONS.map((q, qi) => (
          <FadeIn key={q.key} index={qi}>
            <View style={[ui.card, { gap: 10 }]}>
              <View style={{ gap: 2 }}>
                <Text style={ui.h3}>{q.title}</Text>
                <Text style={ui.small}>{q.hint}</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {q.options.map((o) => {
                  const on = a[q.key] === o;
                  const swatch = q.key === "streak" ? STREAKS.find(([s]) => s === o)?.[1] : undefined;
                  return (
                    <Pressy
                      key={o}
                      feedback={false}
                      accessibilityRole="button"
                      accessibilityLabel={`${q.title}: ${o}`}
                      accessibilityState={{ selected: on }}
                      onPress={() => set(q.key, o)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 18,
                        backgroundColor: on ? c.tint : c.fill,
                      }}
                    >
                      {swatch && (
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: swatch,
                            borderWidth: 0.5,
                            borderColor: c.separator,
                          }}
                        />
                      )}
                      <Text style={{ ...type.subhead, fontWeight: "600", color: on ? c.onTint : c.label }}>
                        {o === "Coin" ? "Copper coin" : o === "Steel" ? "Steel knife" : o === "Nothing" ? "None of these" : o}
                      </Text>
                    </Pressy>
                  );
                })}
              </View>
            </View>
          </FadeIn>
        ))}
        <View style={[ui.between, { paddingHorizontal: 4, marginTop: 4 }]}>
          <Text style={ui.h2}>
            <CountUp value={results.length} style={ui.h2} /> {results.length === 1 ? "match" : "matches"}
          </Text>
        </View>
        {!results.length ? (
          <Empty title="No match" description="Clear one of the tests and try again." />
        ) : (
          <View key={JSON.stringify(a)} style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
            {results.slice(0, 12).map((m, i) => (
              <FadeIn key={m.name} index={i}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${m.name} profile`}
                  onPress={() => open(m.name)}
                  style={({ pressed }) => [
                    ui.row,
                    { gap: 12, paddingLeft: 14, backgroundColor: pressed ? c.fill : "transparent" },
                  ]}
                >
                  <MineralArt color={m.color} habit={m.habit} size={36} />
                  <View
                    style={[
                      ui.row,
                      {
                        flex: 1,
                        paddingVertical: 10,
                        paddingRight: 14,
                        borderBottomWidth: i === Math.min(results.length, 12) - 1 ? 0 : 0.5,
                        borderColor: c.separator,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={ui.h3}>{m.name}</Text>
                      <Text style={ui.small}>
                        {pretty(m.formula)} · H {m.hardness}
                      </Text>
                    </View>
                    {suggested.some((s) => s.toLowerCase() === m.name.toLowerCase()) && (
                      <Sparkles size={15} color={c.tint} />
                    )}
                    <ChevronRight size={16} color={c.tertiary} />
                  </View>
                </Pressable>
              </FadeIn>
            ))}
          </View>
        )}
        {results.length > 12 && (
          <Text style={[ui.caption, { textAlign: "center" }]}>Add a test to narrow {results.length - 12} more.</Text>
        )}
      </ScrollView>
    </View>
  );
}
