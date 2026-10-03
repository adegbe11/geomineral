import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowUpRight,
  BookOpen,
  Camera,
  ChevronRight,
  Compass,
  Folder,
  MapPin,
  Sparkles,
  UserRound,
} from "lucide-react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { Brand, Button, MineralArt } from "./components/Primitives";
import { minerals } from "./minerals";

const FEATURED = ["Gold", "Pyrite", "Quartz", "Malachite", "Amethyst", "Galena"].map(
  (name) => minerals.find((x) => x.name === name)!,
);
import PlaceSearch from "./components/PlaceSearch";
import { useWorkspace } from "./state/Workspace";
import { colors, ui } from "./theme";
import OrbitingEarth from "./components/OrbitingEarth";
export function Terrain({ color = "#CFDFC5" }: { color?: string }) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 200 170"
      style={StyleSheet.absoluteFill}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <Path
          key={i}
          d={`M ${-35 + i * 8} 180 C ${-50 + i * 6} ${30 - i * 2}, ${160 - i * 11} ${180 - i * 8}, ${180 - i * 7} ${-20 - i * 3} S 210 -40 250 0`}
          stroke={color}
          strokeWidth={0.9}
          opacity={0.3 + i * 0.035}
          fill="none"
        />
      ))}
      <Circle cx="133" cy="75" r="19" stroke={color} opacity={0.3} />
      <Circle cx="133" cy="75" r="7" fill={color} />
    </Svg>
  );
}
export default function HomeScreen({
  analyze,
  guide,
}: {
  analyze: () => void;
  guide: (name?: string) => void;
}) {
  const w = useWorkspace();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 115 }}
    >
      <View style={s.hero}>
        <OrbitingEarth style={s.earth} />
        <LinearGradient
          colors={["#051F2866", "#082B2EAA", "#0B302EFF", "#0B302E"]}
          locations={[0, 0.35, 0.85, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.heroTop}>
          <Brand light />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => w.setTab("Profile")}
            style={s.profile}
          >
            <UserRound size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={s.heroCopy}>
          <Text style={s.headline}>
            Explore the Earth.{"\n"}Discover its{"\n"}hidden riches.
          </Text>
        </View>
      </View>
      <View style={s.body}>
        <View style={s.searchPanel}>
          <PlaceSearch onSelect={w.selectLocation} />
          <View style={[ui.row, { paddingHorizontal: 3 }]}>
            <MapPin size={13} color={colors.green} />
            <Text
              style={{ flex: 1, fontSize: 12, color: "#6C7973" }}
              numberOfLines={1}
            >
              {w.location.name}
            </Text>
          </View>
          <Button title="Analyze Location" onPress={analyze} />
        </View>
        <View style={[ui.between, { marginTop: 5 }]}>
          <Text style={s.heading}>Your field tools</Text>
        </View>
        <View style={s.tools}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Map Explorer"
            onPress={() => w.setTab("Explore")}
            style={({ pressed }) => [
              s.tool,
              {
                backgroundColor: "#183F37",
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Terrain />
            <View style={ui.between}>
              <View style={s.toolIcon}>
                <Compass color="#E0E9D8" size={23} />
              </View>
              <ArrowUpRight color="#C7D5C6" size={17} />
            </View>
            <View>
              <Text style={[s.toolTitle, { color: "#fff" }]}>Map Explorer</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan"
            onPress={() => w.setTab("Scan")}
            style={({ pressed }) => [
              s.tool,
              {
                backgroundColor: "#E9E9DD",
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <View
              style={{
                position: "absolute",
                right: -15,
                top: 30,
                opacity: 0.28,
                transform: [{ rotate: "-18deg" }],
              }}
            >
              <MineralArt color="#797D64" habit="point" size={115} />
            </View>
            <View style={ui.between}>
              <View style={[s.toolIcon, { backgroundColor: "#FFFFFF88" }]}>
                <Camera color="#334C3B" size={23} />
              </View>
              <ArrowUpRight color="#667261" size={17} />
            </View>
            <View>
              <Text style={s.toolTitle}>Scan</Text>
            </View>
          </Pressable>
        </View>
        <View style={s.quickRow}>
          {[
            ["My Projects", Folder, () => w.setTab("Projects")],
            ["Mineral Guide", BookOpen, () => guide()],
          ].map(([label, Icon, action]) => {
            const I = Icon as typeof Folder;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={label as string}
                key={label as string}
                onPress={action as () => void}
                style={s.quick}
              >
                <I size={19} color={colors.green} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    flex: 1,
                    color: colors.ink,
                  }}
                >
                  {label as string}
                </Text>
                <ChevronRight size={15} color="#98A19B" />
              </Pressable>
            );
          })}
        </View>
        <View style={[ui.between, { marginTop: 5 }]}>
          <View>
            <Text style={[s.heading, { marginTop: 5 }]}>Minerals</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View mineral guide"
            onPress={() => guide()}
            style={s.roundArrow}
          >
            <ArrowUpRight size={20} color={colors.green} />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingBottom: 7 }}
        >
          {FEATURED.map(({ name, formula: symbol, color, habit, group: category }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Learn about ${name}`}
              key={name}
              onPress={() => guide(name)}
              style={s.specimen}
            >
              <View style={ui.between}>
                <Text style={s.chemical}>{symbol}</Text>
                <ArrowUpRight size={14} color="#9CA79E" />
              </View>
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <MineralArt color={color} habit={habit} size={80} />
              </View>
              <Text
                style={{ fontSize: 16, fontWeight: "600", color: colors.ink }}
              >
                {name}
              </Text>
              <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>
                {category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  hero: {
    minHeight: 315,
    paddingBottom: 58,
    backgroundColor: "#0B302E",
    overflow: "hidden",
  },
  earth: {
    position: "absolute",
    width: 410,
    height: 410,
    right: -135,
    top: -105,
    opacity: 0.86,
    borderRadius: 205,
    transform: [{ rotate: "-22deg" }],
  },
  heroTop: {
    paddingHorizontal: 25,
    paddingTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profile: {
    width: 42,
    height: 42,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#FFFFFF40",
    backgroundColor: "#FFFFFF15",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { paddingHorizontal: 27, paddingTop: 35 },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#D6D9A4" },
  overline: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 2,
    color: "#DBE3CC",
  },
  headline: {
    fontSize: 36,
    lineHeight: 41,
    fontWeight: "600",
    letterSpacing: -1.2,
    color: "#FAFCF3",
  },
  subtitle: { color: "#BBCDC2", fontSize: 13, marginTop: 12 },
  body: { paddingHorizontal: 21, gap: 19 },
  searchPanel: {
    marginTop: -32,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    padding: 19,
    gap: 13,
    boxShadow: "0px 10px 35px rgba(15,45,31,0.10)",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: "#839082",
  },
  heading: {
    fontSize: 21,
    fontWeight: "600",
    letterSpacing: -0.7,
    color: colors.ink,
  },
  tools: { flexDirection: "row", gap: 12 },
  tool: {
    flex: 1,
    height: 163,
    borderRadius: 23,
    padding: 17,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  toolIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#FFFFFF15",
    alignItems: "center",
    justifyContent: "center",
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: "#294331",
  },
  toolSubtitle: { fontSize: 10, color: "#788270", marginTop: 6 },
  quickRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E3E8E0",
    backgroundColor: "#FFFFFF99",
    borderRadius: 19,
    padding: 6,
    gap: 5,
  },
  quick: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 13,
  },
  roundArrow: {
    width: 34,
    height: 34,
    borderRadius: 18,
    backgroundColor: "#E7ECE3",
    justifyContent: "center",
    alignItems: "center",
  },
  specimen: {
    width: 146,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E9ECE5",
  },
  chemical: { fontSize: 17, fontWeight: "500", color: "#9AA591" },
  footnote: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
});
