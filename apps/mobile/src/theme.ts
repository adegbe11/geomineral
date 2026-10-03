import { StyleSheet, useColorScheme, type TextStyle } from "react-native";

// Semantic colours modelled on iOS system colours, with a forest-green tint.
const light = {
  bg: "#F2F3EF",
  card: "#FFFFFF",
  elevated: "#FFFFFF",
  fill: "rgba(118,128,118,0.12)",
  fillStrong: "rgba(118,128,118,0.2)",
  label: "#111813",
  secondary: "rgba(17,24,19,0.72)",
  tertiary: "rgba(17,24,19,0.46)",
  separator: "rgba(17,24,19,0.1)",
  tint: "#1F6B45",
  tintSoft: "rgba(31,107,69,0.12)",
  onTint: "#FFFFFF",
  gold: "#A87A1F",
  danger: "#D7372F",
  glass: "rgba(250,251,248,0.72)",
  glassBorder: "rgba(255,255,255,0.7)",
  hero: "#0B2A24",
  shadow: "0px 1px 2px rgba(17,24,19,0.04), 0px 8px 24px rgba(17,24,19,0.06)",
};
export type Palette = typeof light;
const dark: Palette = {
  bg: "#000000",
  card: "#1C1C1E",
  elevated: "#2C2C2E",
  fill: "rgba(118,118,128,0.24)",
  fillStrong: "rgba(118,118,128,0.36)",
  label: "#F3F6F2",
  secondary: "rgba(235,242,235,0.74)",
  tertiary: "rgba(235,242,235,0.46)",
  separator: "rgba(255,255,255,0.12)",
  tint: "#4CC38A",
  tintSoft: "rgba(76,195,138,0.16)",
  onTint: "#03140B",
  gold: "#E0B355",
  danger: "#FF6961",
  glass: "rgba(28,28,30,0.66)",
  glassBorder: "rgba(255,255,255,0.1)",
  hero: "#06150F",
  shadow: "0px 0px 0px rgba(0,0,0,0)",
};

// Apple text styles at the default Dynamic Type size.
const font = (
  size: number,
  line: number,
  weight: TextStyle["fontWeight"],
  track = 0,
) => ({ fontSize: size, lineHeight: line, fontWeight: weight, letterSpacing: track });
export const type = {
  largeTitle: font(34, 41, "700", 0.37),
  title1: font(28, 34, "700", 0.36),
  title2: font(22, 28, "700", 0.35),
  title3: font(20, 25, "600", 0.38),
  headline: font(17, 22, "600", -0.41),
  body: font(17, 22, "400", -0.41),
  callout: font(16, 21, "400", -0.32),
  subhead: font(15, 20, "400", -0.24),
  footnote: font(13, 18, "400", -0.08),
  caption: font(12, 16, "400", 0),
  caption2: font(11, 13, "400", 0.07),
};

const makeUi = (c: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 120, gap: 16 },
    largeTitle: { ...type.largeTitle, color: c.label },
    title: { ...type.title1, color: c.label },
    h2: { ...type.title3, color: c.label },
    h3: { ...type.headline, color: c.label },
    body: { ...type.subhead, color: c.secondary },
    text: { ...type.body, color: c.label },
    small: { ...type.footnote, color: c.secondary },
    caption: { ...type.caption, color: c.secondary },
    section: {
      ...type.footnote,
      color: c.secondary,
      textTransform: "uppercase",
      marginLeft: 16,
      marginBottom: -8,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    between: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    card: {
      backgroundColor: c.card,
      padding: 16,
      borderRadius: 22,
      borderCurve: "continuous",
      gap: 12,
      boxShadow: c.shadow,
    },
    field: {
      backgroundColor: c.fill,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.label,
      ...type.body,
      minHeight: 46,
    },
    label: { ...type.footnote, color: c.secondary, marginBottom: -6, marginLeft: 4 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.separator },
    error: {
      ...type.footnote,
      padding: 12,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: "rgba(215,55,47,0.1)",
      color: c.danger,
    },
    badge: {
      ...type.caption,
      fontWeight: "600",
      color: c.tint,
      backgroundColor: c.tintSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      overflow: "hidden",
      alignSelf: "flex-start",
    },
  });
const uiLight = makeUi(light),
  uiDark = makeUi(dark);

export function useTheme() {
  const isDark = useColorScheme() === "dark";
  return isDark
    ? { c: dark, ui: uiDark, dark: true }
    : { c: light, ui: uiLight, dark: false };
}

// Screening ratings, strongest first. Report/PDF colours stay fixed for print.
export const ratingColors: Record<string, string> = {
  High: "#1F7A47",
  Moderate: "#C08A1E",
  Low: "#7D8F84",
  "Insufficient evidence": "#A9B3AD",
};
export const ratingColor = (rating?: string) =>
  ratingColors[rating ?? ""] ?? ratingColors["Insufficient evidence"];
export const ratingLabel = (rating?: string) =>
  rating === "Insufficient evidence" ? "Not enough data" : (rating ?? "");
export const siteColor = (status: string) => {
  const s = status.toLowerCase();
  if (s === "producer") return "#E0A526";
  if (s.includes("producer")) return "#D9663B";
  if (s.includes("prospect")) return "#3D86C6";
  return "#93A39A";
};
export const distance = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
