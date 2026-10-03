import { useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BookOpen, Folder, MapPin, UserRound } from "lucide-react-native";
import { Brand, Button, MineralArt, Row } from "./components/Primitives";
import OrbitingEarth from "./components/OrbitingEarth";
import PlaceSearch from "./components/PlaceSearch";
import { minerals, pretty } from "./minerals";
import { FadeIn, Float, Pressy } from "./motion";
import { useWorkspace } from "./state/Workspace";
import { ratingColor, ratingLabel, type, useTheme } from "./theme";

const native = Platform.OS !== "web";
// A different mineral each day, same for everyone.
const today = () => {
  const pool = minerals.filter((m) => !m.rock);
  const day = Math.floor(Date.now() / 86_400_000);
  return pool[day % pool.length];
};

export default function HomeScreen({
  analyze,
  guide,
  openRecent,
}: {
  analyze: () => void;
  guide: (name?: string) => void;
  openRecent: (id: string) => void;
}) {
  const w = useWorkspace();
  const { c, ui } = useTheme();
  const y = useRef(new Animated.Value(0)).current;
  const featured = today();
  return (
    <Animated.ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 120 }}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
        useNativeDriver: native,
      })}
    >
      <View style={[s.hero, { backgroundColor: c.hero }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                {
                  translateY: y.interpolate({
                    inputRange: [-200, 0, 300],
                    outputRange: [-60, 0, 120],
                    extrapolate: "clamp",
                  }),
                },
              ],
            },
          ]}
        >
          <OrbitingEarth style={s.earth} />
        </Animated.View>
        <LinearGradient
          colors={["#04140F55", "#06201999", c.hero]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.heroTop}>
          <Brand light />
          <Pressy
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => w.setTab("Profile")}
            style={s.profile}
          >
            <UserRound size={19} color="#fff" />
          </Pressy>
        </View>
        <FadeIn delay={80} style={{ paddingHorizontal: 20, paddingTop: 44 }}>
          <Text style={{ ...type.largeTitle, color: "#fff" }}>
            Explore what lies{"\n"}beneath you.
          </Text>
        </FadeIn>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 22 }}>
        <FadeIn delay={140}>
          <View style={[ui.card, { marginTop: -36, padding: 16, gap: 12 }]}>
            <PlaceSearch onSelect={w.selectLocation} />
            <View style={[ui.row, { gap: 6, paddingHorizontal: 4 }]}>
              <MapPin size={14} color={c.tint} />
              <Text style={[ui.small, { flex: 1 }]} numberOfLines={1}>
                {w.location.name}
              </Text>
            </View>
            <Button title="Analyze Location" onPress={analyze} />
          </View>
        </FadeIn>

        {w.recent.length > 0 && (
          <View style={{ gap: 14 }}>
            <Text style={ui.section}>Recent</Text>
            <View style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
              {w.recent.slice(0, 4).map((r, i, list) => {
                const top = r.result.assessments.find(
                  (a) => a.prospectivity !== "Insufficient evidence",
                );
                return (
                  <FadeIn key={r.id} index={i}>
                    <Row
                      accessibilityLabel={`Open analysis of ${r.location.name}`}
                      title={r.location.name}
                      detail={top ? `${top.commodity} · ${ratingLabel(top.prospectivity)}` : "No signal"}
                      last={i === list.length - 1}
                      onPress={() => openRecent(r.id)}
                      icon={
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: ratingColor(top?.prospectivity),
                          }}
                        />
                      }
                    />
                  </FadeIn>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ gap: 14 }}>
          <Text style={ui.section}>Mineral of the Day</Text>
          <FadeIn delay={200}>
            <Pressy
              accessibilityRole="button"
              accessibilityLabel={`Learn about ${featured.name}`}
              onPress={() => guide(featured.name)}
              scaleTo={0.97}
              style={[ui.card, { flexDirection: "row", alignItems: "center", gap: 16, padding: 18 }]}
            >
              <View
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: featured.color + "22",
                }}
              >
                <Float>
                  <MineralArt color={featured.color} habit={featured.habit} size={70} />
                </Float>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={ui.h2}>{featured.name}</Text>
                <Text style={ui.small}>{pretty(featured.formula)}</Text>
                <Text style={ui.body} numberOfLines={2}>
                  {featured.traits.split(". ")[0]}.
                </Text>
              </View>
            </Pressy>
          </FadeIn>
        </View>

        <View style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
          <Row
            title="Mineral Guide"
            detail={`${minerals.length}`}
            onPress={() => guide()}
            icon={<BookOpen size={20} color={c.tint} />}
          />
          <Row
            title="My Projects"
            last
            onPress={() => w.setTab("Projects")}
            icon={<Folder size={20} color={c.tint} />}
          />
        </View>
      </View>
    </Animated.ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { height: 330, overflow: "hidden" },
  earth: {
    position: "absolute",
    width: 420,
    height: 420,
    right: -140,
    top: -110,
    opacity: 0.9,
    borderRadius: 210,
  },
  heroTop: {
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "#FFFFFF40",
    backgroundColor: "#FFFFFF1F",
    alignItems: "center",
    justifyContent: "center",
  },
});
