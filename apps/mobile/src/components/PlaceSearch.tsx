import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { MapPin, Search } from "lucide-react-native";
import type { Location } from "../types";
import { api } from "../services/api";
import { colors, ui } from "../theme";
export default function PlaceSearch({
  onSelect,
  dark,
}: {
  onSelect: (location: Location) => void;
  dark?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Location[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    try {
      const found = await api<Location[]>(
        `/search?q=${encodeURIComponent(query.trim())}`,
      );
      setResults(found);
      if (!found.length)
        setError("No matching places. Try latitude, longitude.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 9 }}>
      <View
        style={[
          ui.row,
          {
            backgroundColor: "#F2F5EF",
            borderWidth: 1,
            borderColor: "#E8ECE3",
            borderRadius: 17,
            minHeight: 50,
            paddingHorizontal: 13,
          },
        ]}
      >
        <Search size={18} color="#8B94A3" />
        <TextInput
          accessibilityLabel="Search any location"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setResults([]);
            setError("");
          }}
          placeholder="Search any location"
          placeholderTextColor="#9098A5"
          returnKeyType="search"
          onSubmitEditing={search}
          style={{
            flex: 1,
            minWidth: 0,
            height: 49,
            fontSize: 13,
            color: colors.ink,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search places"
          onPress={search}
          hitSlop={10}
        >
          {busy ? (
            <ActivityIndicator color={colors.green} />
          ) : (
            <MapPin size={18} color={colors.green} />
          )}
        </Pressable>
      </View>
      {results.length > 0 && (
        <View style={[ui.card, { padding: 7 }]}>
          {results.map((result, i) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={result.name}
              key={i}
              onPress={() => {
                onSelect(result);
                setResults([]);
                setQuery("");
              }}
              style={{
                padding: 11,
                borderBottomWidth: i === results.length - 1 ? 0 : 1,
                borderColor: colors.line,
              }}
            >
              <Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>
                {result.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={[ui.small, { color: dark ? "#E8D7B0" : "#856432" }]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
