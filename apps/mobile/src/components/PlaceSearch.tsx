import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { MapPin, Search } from "lucide-react-native";
import type { Location } from "../types";
import { api } from "../services/api";
import { FadeIn, haptic } from "../motion";
import { type, useTheme } from "../theme";

export default function PlaceSearch({
  onSelect,
  dark,
}: {
  onSelect: (location: Location) => void;
  /** Glass style for use over a map. */
  dark?: boolean;
}) {
  const { c, ui } = useTheme();
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Location[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    try {
      const found = await api<Location[]>(`/search?q=${encodeURIComponent(query.trim())}`);
      setResults(found);
      if (!found.length) setError("No matching places. Try latitude, longitude.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: dark ? c.glass : c.fill,
          borderRadius: 22,
          minHeight: 44,
          paddingHorizontal: 14,
          borderWidth: dark ? 0.5 : 0,
          borderColor: c.glassBorder,
          boxShadow: dark ? "0px 8px 24px rgba(0,0,0,0.18)" : undefined,
        }}
      >
        <Search size={17} color={c.secondary} />
        <TextInput
          accessibilityLabel="Search any location"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setResults([]);
            setError("");
          }}
          placeholder="Search any location"
          placeholderTextColor={c.tertiary}
          returnKeyType="search"
          onSubmitEditing={search}
          style={{ flex: 1, minWidth: 0, height: 44, ...type.body, color: c.label }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search places"
          onPress={search}
          hitSlop={10}
        >
          {busy ? <ActivityIndicator color={c.tint} /> : <MapPin size={18} color={c.tint} />}
        </Pressable>
      </View>
      {results.length > 0 && (
        <FadeIn>
          <View style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
            {results.map((result, i) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={result.name}
                key={i}
                onPress={() => {
                  haptic.select();
                  onSelect(result);
                  setResults([]);
                  setQuery("");
                }}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? c.fill : "transparent",
                  borderBottomWidth: i === results.length - 1 ? 0 : 0.5,
                  borderColor: c.separator,
                })}
              >
                <Text style={{ ...type.subhead, color: c.label }} numberOfLines={2}>
                  {result.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </FadeIn>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ ...type.footnote, color: dark ? "#FFE3A8" : c.gold, marginLeft: 8 }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
