import { useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Navigation } from "lucide-react-native";
import NativeMap from "./components/NativeMap";
import { heatColor } from "./components/mapStyle";
import { Button, Empty, Header } from "./components/Primitives";
import { FadeIn, haptic, Pressy, Segmented } from "./motion";
import { useWorkspace } from "./state/Workspace";
import { type, useTheme } from "./theme";
import type { Target } from "./types";

const RAMP = ["#F7E27A", "#F2A33A", "#E2552F", "#B5122E"];

// Opens turn-by-turn directions in the phone's own maps app.
const directions = (t: Target) => {
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${t.lat},${t.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`;
  void Linking.openURL(url);
};

function Bar({ value }: { value: number }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.fill, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(value * 100)}%`, height: 6, borderRadius: 3, backgroundColor: heatColor(value) }} />
    </View>
  );
}

export default function ZonesScreen({ back }: { back: () => void }) {
  const w = useWorkspace();
  const { c, ui } = useTheme();
  const a = w.analysis;
  const zones = a?.zones?.by_commodity ?? {};
  const minerals = Object.keys(zones);
  const [mineral, setMineral] = useState(minerals[0] ?? "");
  const [selected, setSelected] = useState<string>();
  const zone = zones[mineral];
  if (!a || !zone)
    return (
      <View style={ui.page}>
        <Header title="Potential Zones" back={back} />
        <View style={ui.content}>
          <Empty title="No potential zones" description="Zones need mapped rocks or recorded sites with positions." />
        </View>
      </View>
    );
  const pick = (t: Target) => {
    haptic.select();
    setSelected(t.id);
  };
  return (
    <View style={ui.page}>
      <Header title="Potential Zones" back={back} />
      <ScrollView contentContainerStyle={ui.content}>
        <View style={[s.map, { backgroundColor: c.hero }]}>
          <NativeMap
            location={a.location}
            satellite
            polygon={[]}
            drawing={false}
            interactive={false}
            radiusKm={a.radius_km}
            heat={{ cells: zone.cells, cellKm: a.zones?.cell_km ?? 2 }}
            targets={zone.targets}
            selectedTarget={selected}
            onTarget={pick}
            onSelect={() => {}}
          />
          <View pointerEvents="none" style={s.legend}>
            <Text style={s.legendText}>Low</Text>
            <View style={{ flexDirection: "row", borderRadius: 3, overflow: "hidden" }}>
              {RAMP.map((col) => (
                <View key={col} style={{ width: 22, height: 6, backgroundColor: col }} />
              ))}
            </View>
            <Text style={s.legendText}>High</Text>
          </View>
        </View>
        {minerals.length > 1 && (
          <Segmented
            items={minerals}
            value={mineral}
            onChange={(m) => {
              setMineral(m);
              setSelected(undefined);
            }}
          />
        )}
        <Text style={ui.section}>Targets</Text>
        {!zone.targets.length && (
          <Empty title="No standout target" description="Potential is spread thinly across this radius." />
        )}
        {zone.targets.map((t, i) => (
          <FadeIn key={t.id} index={i}>
            <Pressy
              accessibilityRole="button"
              accessibilityLabel={`Target ${t.id}`}
              scaleTo={0.98}
              onPress={() => pick(t)}
              style={[ui.card, { gap: 10 }, selected === t.id && { borderWidth: 1.5, borderColor: heatColor(t.score) }]}
            >
              <View style={ui.between}>
                <View style={{ gap: 2 }}>
                  <Text style={ui.h3}>{t.id}</Text>
                  <Text style={ui.small}>
                    {t.commodity} · {t.area_km2} km² · {t.distance_km} km from the pin
                  </Text>
                </View>
                <Text style={{ ...type.title3, color: heatColor(t.score) }}>{Math.round(t.score * 100)}</Text>
              </View>
              <Bar value={t.score} />
              {t.reasons.map((r) => (
                <Text key={r} style={ui.body}>
                  · {r}
                </Text>
              ))}
              <Button
                outline
                title="Directions"
                icon={<Navigation size={17} color={c.tint} />}
                onPress={() => directions(t)}
              />
            </Pressy>
          </FadeIn>
        ))}
        <Text style={[ui.caption, { paddingHorizontal: 4 }]}>
          Scores rank evidence inside this radius. Field checks, sampling and permission come first.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  map: { height: 320, borderRadius: 26, overflow: "hidden" },
  legend: {
    position: "absolute",
    right: 10,
    top: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(17,24,19,0.72)",
  },
  legendText: { fontSize: 11, fontWeight: "600", color: "#fff" },
});
