import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";

// Apple's own material on iOS 26+, so the iOS 27 glass slider and Reduce
// Transparency apply to our glass exactly as they do to system glass.
const native = isLiquidGlassAvailable();

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

/** Glass backdrop: native Liquid Glass, a blur fallback, or an opaque fill on request. */
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
  if (native)
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={dark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
    );
  if (reduce) return <View style={[StyleSheet.absoluteFill, { backgroundColor: solid }]} />;
  return <BlurView intensity={intensity} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />;
}
