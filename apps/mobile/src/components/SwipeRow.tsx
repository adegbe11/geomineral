import { Trash2 } from "lucide-react-native";
import { useRef, type ReactNode } from "react";
import { Animated, PanResponder, Platform, Pressable, Text, View } from "react-native";
import { haptic, SPRING_PRESS } from "../motion";
import { type, useTheme } from "../theme";

const ACTION = 96;
const native = Platform.OS !== "web";
type Guard = (fn: () => void) => () => void;

/** iOS-style swipe to reveal Delete; the visible Delete control stays for VoiceOver. */
export default function SwipeRow({
  children,
  onDelete,
  label,
}: {
  /** A render function receives a guard for the row's tap, so a swipe never doubles as a tap. */
  children: ReactNode | ((guard: Guard) => ReactNode);
  onDelete: () => void;
  label: string;
}) {
  const { c } = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const base = useRef(0);
  const dragged = useRef(0);

  const settle = (open: boolean) => {
    base.current = open ? -ACTION : 0;
    if (open) haptic.select();
    Animated.spring(x, { toValue: base.current, ...SPRING_PRESS, useNativeDriver: native }).start();
  };

  const pan = useRef(
    PanResponder.create({
      // Claim only clearly sideways drags; vertical scrolling stays with the list.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => (dragged.current = Date.now()),
      onPanResponderMove: (_, g) => {
        const next = base.current + g.dx;
        // Rubber-band past the action width, like UIKit.
        x.setValue(next < -ACTION ? -ACTION + (next + ACTION) / 3 : Math.min(0, next));
      },
      onPanResponderRelease: (_, g) => {
        dragged.current = Date.now();
        settle(base.current + g.dx < -ACTION / 2 || g.vx < -0.5);
      },
      onPanResponderTerminate: () => settle(base.current !== 0),
    }),
  ).current;

  // Like Mail: a tap on an open row closes it; a tap that ends a swipe does nothing.
  const guard: Guard = (fn) => () => {
    if (Date.now() - dragged.current < 350) return;
    if (base.current !== 0) return settle(false);
    fn();
  };

  return (
    <View>
      <Animated.View
        // Screen readers use the row's own Delete control instead of the gesture.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: ACTION,
          paddingLeft: 10,
          opacity: x.interpolate({ inputRange: [-ACTION, -20, 0], outputRange: [1, 0.4, 0] }),
        }}
      >
        <Pressable
          testID={`swipe-delete-${label}`}
          onPress={() => {
            haptic.warning();
            settle(false);
            onDelete();
          }}
          style={{
            flex: 1,
            borderRadius: 22,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            backgroundColor: c.danger,
          }}
        >
          <Trash2 size={20} color="#fff" />
          <Text style={{ ...type.caption, fontWeight: "600", color: "#fff" }}>Delete</Text>
        </Pressable>
      </Animated.View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>
        {typeof children === "function" ? children(guard) : children}
      </Animated.View>
    </View>
  );
}
