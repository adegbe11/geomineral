import { useEffect, useRef, type ReactNode } from "react";
import { Animated, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { DeviceMotion } from "expo-sensors";
import { useReduceMotion } from "../motion";

const MAX_TILT = 0.5; // radians of roll/pitch that sweep the streak edge to edge
const SMOOTHING = 0.18; // low-pass factor per sample (~30 Hz)

/**
 * A light streak that moves across a crystal as the phone tilts.
 * Roll (gamma) drives X, pitch (beta) drives Y; peak opacity is 20%.
 */
export default function CrystalShimmer({
  size,
  radius = 22,
  children,
}: {
  size: number;
  radius?: number;
  children: ReactNode;
}) {
  const still = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const sx = useRef(0),
    sy = useRef(0);
  useEffect(() => {
    if (still) return;
    let sub: { remove: () => void } | null = null;
    let live = true;
    DeviceMotion.isAvailableAsync()
      .then((ok) => {
        if (!ok || !live) return;
        DeviceMotion.setUpdateInterval(33);
        sub = DeviceMotion.addListener(({ rotation }) => {
          if (!rotation) return;
          const clamp = (v: number) => Math.max(-1, Math.min(1, v / MAX_TILT));
          // Pitch is ~0.7 rad when a phone is held naturally; measure from there.
          sx.current += (clamp(rotation.gamma) - sx.current) * SMOOTHING;
          sy.current += (clamp(rotation.beta - 0.7) - sy.current) * SMOOTHING;
          x.setValue(sx.current);
          y.setValue(sy.current);
        });
      })
      .catch(() => {});
    return () => {
      live = false;
      sub?.remove();
    };
  }, [still]);
  const band = size * 0.55;
  return (
    <View style={{ width: size, height: size, borderRadius: radius, borderCurve: "continuous", overflow: "hidden" }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: (size - band) / 2,
          top: -size * 0.3,
          width: band,
          height: size * 1.6,
          transform: [
            { translateX: x.interpolate({ inputRange: [-1, 1], outputRange: [-size * 0.75, size * 0.75] }) },
            { translateY: y.interpolate({ inputRange: [-1, 1], outputRange: [-size * 0.25, size * 0.25] }) },
            { rotate: "24deg" },
          ],
        }}
      >
        <LinearGradient
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.2)", "rgba(255,255,255,0)"]}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
