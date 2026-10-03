import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Platform,
  type StyleProp,
  type ImageStyle,
} from "react-native";

export default function OrbitingEarth({
  style,
  zoom,
}: {
  style: StyleProp<ImageStyle>;
  /** Optional scale driven by the caller (Analyze zoom). */
  zoom?: Animated.Value;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  const [active, setActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted && !preferenceChanged) setReduceMotion(enabled);
      })
      .catch(() => {});
    const preference = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        preferenceChanged = true;
        setReduceMotion(enabled);
      },
    );
    const state = AppState.addEventListener("change", (next) =>
      setActive(next === "active"),
    );
    return () => {
      mounted = false;
      preference.remove();
      state.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || !active) return;
    // One full turn every 120 s, linear: an atmosphere, not a spinning wheel.
    const rotation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 120000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      }),
    );
    rotation.start();
    return () => rotation.stop();
  }, [active, reduceMotion, spin]);

  return (
    <Animated.Image
      accessible={false}
      testID="orbiting-earth"
      source={require("../../assets/earth.jpg")}
      style={[
        style,
        {
          transform: [
            { scale: zoom ?? 1 },
            {
              rotate: reduceMotion
                ? "-22deg"
                : spin.interpolate({ inputRange: [0, 1], outputRange: ["-22deg", "338deg"] }),
            },
          ],
        },
      ]}
    />
  );
}
