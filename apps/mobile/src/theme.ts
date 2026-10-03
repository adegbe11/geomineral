import { StyleSheet } from "react-native";
export const colors = {
  green: "#245B40",
  dark: "#071B16",
  gold: "#C99F43",
  ink: "#20372C",
  muted: "#78818F",
  line: "#EAECF0",
  bg: "#F3F5EF",
  pale: "#EAF4ED",
  white: "#FFFFFF",
};
export const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 22, paddingBottom: 115, gap: 20 },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.9,
    lineHeight: 37,
  },
  h2: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.35,
  },
  h3: { fontSize: 15, fontWeight: "700", color: colors.ink },
  body: { fontSize: 13, lineHeight: 21, color: colors.muted },
  small: { fontSize: 11, lineHeight: 17, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  card: {
    backgroundColor: "#fff",
    padding: 21,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
    boxShadow: "0px 6px 22px rgba(23,41,30,0.04)",
  },
  field: {
    backgroundColor: "#fff",
    borderColor: "#DFE3E9",
    borderWidth: 1,
    borderRadius: 17,
    padding: 14,
    color: colors.ink,
    fontSize: 14,
    minHeight: 49,
  },
  label: { fontSize: 12, color: "#4D5766", fontWeight: "600", marginBottom: 7 },
  divider: { height: 1, backgroundColor: colors.line },
  error: {
    padding: 13,
    backgroundColor: "#FFF6E9",
    borderRadius: 10,
    color: "#79582E",
    fontSize: 12,
    lineHeight: 19,
  },
  badge: {
    color: colors.green,
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: colors.pale,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
});

// Screening ratings, strongest first.
export const ratingColors: Record<string, string> = {
  High: "#1F7A47",
  Moderate: "#C08A1E",
  Low: "#7D8F84",
  "Insufficient evidence": "#A9B3AD",
};
export const ratingColor = (rating?: string) =>
  ratingColors[rating ?? ""] ?? ratingColors["Insufficient evidence"];
export const siteColor = (status: string) => {
  const s = status.toLowerCase();
  if (s === "producer") return "#E0A526";
  if (s.includes("producer")) return "#D9663B";
  if (s.includes("prospect")) return "#3D86C6";
  return "#93A39A";
};
export const distance = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
