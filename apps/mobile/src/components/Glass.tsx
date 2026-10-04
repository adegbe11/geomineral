import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";

/** Follows the system Reduce Transparency setting (iOS); other platforms report false. */
export function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((on) => mounted && setReduce(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Glass backdrop: live blur, or an opaque fill when the user asks for less transparency. */
export default function GlassFill({
  intensity,
  dark,
  solid,
}: {
  intensity: number;
  dark: boolean;
  /** Opaque colour used when Reduce Transparency is on. */
  solid: string;
}) {
  const reduce = useReduceTransparency();
  if (reduce) return <View style={[StyleSheet.absoluteFill, { backgroundColor: solid }]} />;
  return <BlurView intensity={intensity} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />;
}
