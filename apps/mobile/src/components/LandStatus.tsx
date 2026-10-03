import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react-native";
import { FadeIn, Shimmer } from "../motion";
import { api } from "../services/api";
import { useTheme } from "../theme";
import type { Location } from "../types";

type Land = {
  covered: boolean;
  status: string;
  guidance: string;
  manager?: string;
  unit?: string;
  source: string;
};
const STOP = ["No collecting", "Restricted", "Protected"];
const ASK = ["Permission needed", "Private", "No public land record", "Check local rules"];

/** Who manages the land here and what that usually means for collecting. */
export default function LandStatus({ location }: { location: Location }) {
  const { c, ui } = useTheme();
  const [land, setLand] = useState<Land | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    setLand(null);
    setFailed(false);
    api<Land>(`/land?lat=${location.lat}&lng=${location.lng}`)
      .then(setLand)
      .catch(() => setFailed(true));
  }, [location.lat, location.lng]);
  if (failed) return null;
  if (!land) return <Shimmer style={{ height: 76, borderRadius: 22 }} />;
  const color = STOP.includes(land.status)
    ? c.danger
    : ASK.includes(land.status)
      ? c.gold
      : land.covered
        ? c.tint
        : c.secondary;
  const Icon = STOP.includes(land.status) ? ShieldAlert : land.covered ? ShieldCheck : ShieldQuestion;
  return (
    <FadeIn>
      <View accessibilityLabel={`Land: ${land.status}`} style={[ui.card, { flexDirection: "row", gap: 12 }]}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color + "22",
          }}
        >
          <Icon size={20} color={color} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[ui.h3, { color }]}>{land.status}</Text>
          {!!(land.unit || land.manager) && (
            <Text style={[ui.small, { color: c.label }]} numberOfLines={2}>
              {[land.unit, land.manager].filter(Boolean).join(" · ")}
            </Text>
          )}
          <Text style={ui.small}>{land.guidance}</Text>
          <Text style={ui.caption}>{land.source}</Text>
        </View>
      </View>
    </FadeIn>
  );
}
