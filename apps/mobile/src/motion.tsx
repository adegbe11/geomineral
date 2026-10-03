import * as Haptics from "expo-haptics";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityRole,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { type, useTheme } from "./theme";

const native = Platform.OS !== "web";

// Shared physics, mirrored in docs/motion.md.
export const SPRING_PRESS = { stiffness: 300, damping: 25, mass: 1 };
export const EASE_REVEAL = Easing.bezier(0.25, 1, 0.5, 1); // 0.4 s reveals
export const EASE_OUT = Easing.out(Easing.cubic);

// One shared Reduce Motion flag for the whole app.
let reduced = false;
const listeners = new Set<(v: boolean) => void>();
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduced = v;
    listeners.forEach((l) => l(v));
  })
  .catch(() => {});
AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => {
  reduced = v;
  listeners.forEach((l) => l(v));
});
export function useReduceMotion() {
  const [value, setValue] = useState(reduced);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

export const haptic = {
  tap: () =>
    native && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  select: () => native && void Haptics.selectionAsync().catch(() => {}),
  success: () =>
    native &&
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () =>
    native &&
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  heavy: () =>
    native && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
};

/** Fades and rises into place; staggered by index. */
export function FadeIn({
  children,
  index = 0,
  delay = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const still = useReduceMotion();
  const v = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) return v.setValue(1);
    Animated.timing(v, {
      toValue: 1,
      duration: 420,
      delay: delay + Math.min(index, 8) * 45,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: native,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that compresses with a spring and gives a light tap. */
export function Pressy({
  children,
  style,
  scaleTo = 0.96,
  feedback = true,
  onPress,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  feedback?: boolean;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(s, { toValue: to, ...SPRING_PRESS, useNativeDriver: native }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        spring(scaleTo);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        spring(1);
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (feedback) haptic.tap();
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Counts up to a number. */
export function CountUp({ value, style }: { value: number; style?: StyleProp<any> }) {
  const still = useReduceMotion();
  const [shown, setShown] = useState(still ? value : 0);
  useEffect(() => {
    if (still) return setShown(value);
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: x }) => setShown(Math.round(x)));
    Animated.timing(v, {
      toValue: value,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => v.removeListener(id);
  }, [value]);
  return <Text style={style}>{shown}</Text>;
}

/** Placeholder block that breathes while content loads. */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const still = useReduceMotion();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: native }),
        Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still]);
  return (
    <Animated.View
      style={[{ backgroundColor: c.fillStrong, borderRadius: 10, opacity: v }, style]}
    />
  );
}

/** iOS segmented control with a sliding thumb. */
export function Segmented<T extends string | number>({
  items,
  value,
  onChange,
  label = (x) => String(x),
  a11y,
  role = "button",
  glass,
}: {
  items: T[];
  value: T;
  onChange: (v: T) => void;
  label?: (v: T) => string;
  a11y?: (v: T) => string;
  role?: AccessibilityRole;
  glass?: boolean;
}) {
  const { c, dark } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, items.indexOf(value));
  const x = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(x, {
      toValue: index,
      speed: 20,
      bounciness: 6,
      useNativeDriver: native,
    }).start();
  }, [index]);
  const seg = width ? (width - 4) / items.length : 0;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        padding: 2,
        borderRadius: 10,
        backgroundColor: glass ? c.glass : c.fill,
      }}
    >
      {!!seg && (
        <Animated.View
          style={{
            position: "absolute",
            top: 2,
            bottom: 2,
            left: 2,
            width: seg,
            borderRadius: 8,
            backgroundColor: dark ? "#636366" : "#FFFFFF",
            boxShadow: "0px 3px 8px rgba(0,0,0,0.12), 0px 1px 1px rgba(0,0,0,0.04)",
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, seg] }) }],
          }}
        />
      )}
      {items.map((item) => (
        <Pressable
          key={String(item)}
          accessibilityRole={role}
          accessibilityLabel={a11y ? a11y(item) : label(item)}
          accessibilityState={{ selected: item === value }}
          aria-selected={item === value}
          onPress={() => {
            if (item !== value) haptic.select();
            onChange(item);
          }}
          style={{ flex: 1, alignItems: "center", paddingVertical: 7 }}
        >
          <Text
            style={{
              ...type.footnote,
              fontWeight: item === value ? "600" : "500",
              color: c.label,
            }}
          >
            {label(item)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// Pushed screens slide in from the right and can be swiped back from the left edge.
// Children receive the animated back so each screen decides what "back" means.
export function StackScreen({
  children,
  onBack,
  from = "right",
}: {
  children: (back: () => void) => ReactNode;
  onBack: () => void;
  /** "bottom" rises like a results sheet; "right" is a standard push. */
  from?: "right" | "bottom";
}) {
  const { width, height } = useWindowDimensions();
  const { c } = useTheme();
  const still = useReduceMotion();
  const sheet = from === "bottom";
  const w = sheet ? height : Math.min(width, 430);
  const x = useRef(new Animated.Value(still ? 0 : w)).current;
  const leaving = useRef(false);
  useEffect(() => {
    if (still) return;
    if (sheet)
      Animated.timing(x, { toValue: 0, duration: 400, easing: EASE_REVEAL, useNativeDriver: native }).start();
    else Animated.spring(x, { toValue: 0, speed: 16, bounciness: 0, useNativeDriver: native }).start();
  }, []);
  const back = () => {
    if (leaving.current) return;
    leaving.current = true;
    if (still) return onBack();
    Animated.timing(x, {
      toValue: w,
      duration: sheet ? 320 : 260,
      easing: Easing.bezier(0.3, 0, 0.6, 1),
      useNativeDriver: native,
    }).start(() => onBack());
  };
  const pan = useRef(
    PanResponder.create({
      // Right pushes: swipe from the left edge. Sheets: drag down from the top bar.
      onMoveShouldSetPanResponder: (e, g) =>
        sheet
          ? g.y0 - g.dy < 110 && g.dy > 10 && Math.abs(g.dx) < Math.abs(g.dy)
          : g.x0 - g.dx < 28 && g.dx > 8 && Math.abs(g.dy) < Math.abs(g.dx),
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, sheet ? g.dy : g.dx)),
      onPanResponderRelease: (_, g) => {
        const d = sheet ? g.dy : g.dx,
          v = sheet ? g.vy : g.vx;
        if (d > w * (sheet ? 0.2 : 0.33) || v > 0.6) {
          haptic.select();
          back();
        } else Animated.spring(x, { toValue: 0, ...SPRING_PRESS, useNativeDriver: native }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(x, { toValue: 0, ...SPRING_PRESS, useNativeDriver: native }).start(),
    }),
  ).current;
  return (
    <Animated.View
        {...pan.panHandlers}
        style={{
          flex: 1,
          backgroundColor: c.bg,
          transform: [sheet ? { translateY: x } : { translateX: x }],
          boxShadow: sheet ? "0px -8px 30px rgba(0,0,0,0.25)" : "-8px 0px 24px rgba(0,0,0,0.08)",
        }}
      >
        {children(back)}
      </Animated.View>
  );
}

/** Cross-fades content when its key changes (tab switches). */
export function TabFade({ children, id }: { children: ReactNode; id: string }) {
  const still = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current || still) {
      first.current = false;
      return;
    }
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [id]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: v,
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Gentle floating motion for hero artwork. */
export function Float({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const still = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still]);
  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
            { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
