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
}: {
  style: StyleProp<ImageStyle>;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
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
    spin.setValue(0);
    orbit.setValue(0);
    const config = {
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    };
    const rotation = Animated.loop(
      Animated.timing(spin, { ...config, toValue: 1, duration: 160000 }),
    );
    const drift = Animated.loop(
      Animated.timing(orbit, { ...config, toValue: 1, duration: 24000 }),
    );
    rotation.start();
    drift.start();
    return () => {
      rotation.stop();
      drift.stop();
    };
  }, [active, reduceMotion, spin, orbit]);

  const phases = Array.from({ length: 33 }, (_, i) => i / 32);
  return (
    <Animated.Image
      accessible={false}
      testID="orbiting-earth"
      source={require("../../assets/earth.jpg")}
      style={[
        style,
        {
          transform: reduceMotion
            ? [{ rotate: "-22deg" }]
            : [
                {
                  translateX: orbit.interpolate({
                    inputRange: phases,
                    outputRange: phases.map(
                      (p) => Math.cos(p * Math.PI * 2) * 10 - 10,
                    ),
                  }),
                },
                {
                  translateY: orbit.interpolate({
                    inputRange: phases,
                    outputRange: phases.map(
                      (p) => Math.sin(p * Math.PI * 2) * 7,
                    ),
                  }),
                },
                {
                  rotate: spin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["-22deg", "338deg"],
                  }),
                },
              ],
        },
      ]}
    />
  );
}
