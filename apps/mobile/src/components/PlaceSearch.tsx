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
  tone,
  current,
}: {
  onSelect: (location: Location) => void;
  /** Glass style for use over a map. */
  dark?: boolean;
  /** Fixed light-on-dark style for glass cards on the Home planet. */
  tone?: "glass";
  /** The selected place, shown inside the field until the user types. */
  current?: string;
}) {
  const theme = useTheme();
  const { ui } = theme;
  const c =
    tone === "glass"
      ? {
          ...theme.c,
          label: "#FFFFFF",
          secondary: "rgba(255,255,255,0.8)",
          tertiary: "rgba(255,255,255,0.6)",
          fill: "rgba(0,0,0,0.24)",
          tint: "#5FD39A",
          gold: "#F4CF7A",
        }
      : theme.c;
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Location[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const showCurrent = !!current && !focused && !query;
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
        {showCurrent ? <MapPin size={17} color={c.tint} /> : <Search size={17} color={c.secondary} />}
        <TextInput
          accessibilityLabel="Search any location"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setResults([]);
            setError("");
          }}
          placeholder={showCurrent ? current : "Search any location"}
          placeholderTextColor={showCurrent ? c.label : c.tertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
          {busy ? (
            <ActivityIndicator color={c.tint} />
          ) : showCurrent ? (
            <Search size={17} color={c.secondary} />
          ) : (
            <MapPin size={18} color={c.tint} />
          )}
        </Pressable>
      </View>
      {results.length > 0 && (
        <FadeIn>
          <View
            style={[
              ui.card,
              { padding: 0, gap: 0, overflow: "hidden" },
              tone === "glass" && { backgroundColor: "#12352BF2", boxShadow: "none" },
            ]}
          >
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
