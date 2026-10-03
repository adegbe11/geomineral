import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { Pressy } from "../motion";
import { type, useTheme } from "../theme";

/** Filled (default), tinted (`outline`) or plain capsule button. */
export function Button({
  title,
  onPress,
  outline,
  plain,
  busy,
  icon,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  outline?: boolean;
  plain?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const fg = outline || plain ? c.tint : c.onTint;
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        {
          minHeight: 50,
          borderRadius: 25,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 20,
          backgroundColor: plain ? "transparent" : outline ? c.tintSoft : c.tint,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon}
      <Text style={{ ...type.headline, color: fg }}>{title}</Text>
    </Pressy>
  );
}

/** Navigation bar: inline title, or a large title for root screens. */
export function Header({
  title,
  back,
  right,
  dark,
  large,
}: {
  title: string;
  back?: () => void;
  right?: ReactNode;
  dark?: boolean;
  large?: boolean;
}) {
  const { c } = useTheme();
  const goBack = back;
  const fg = dark ? "#fff" : c.label;
  if (large && !goBack)
    return (
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 6,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          backgroundColor: dark ? "transparent" : c.bg,
        }}
      >
        <Text accessibilityRole="header" style={{ ...type.largeTitle, color: fg }}>
          {title}
        </Text>
        <View style={{ paddingBottom: 6 }}>{right}</View>
      </View>
    );
  return (
    <View
      style={{
        height: 52,
        paddingHorizontal: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: dark ? "transparent" : c.bg,
      }}
    >
      <View style={{ width: 64 }}>
        {goBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={goBack}
            hitSlop={12}
            style={{ flexDirection: "row", alignItems: "center", padding: 4 }}
          >
            <ChevronLeft size={28} color={dark ? "#fff" : c.tint} strokeWidth={2.4} />
          </Pressable>
        )}
      </View>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={{ ...type.headline, color: fg, flex: 1, textAlign: "center" }}
      >
        {title}
      </Text>
      <View style={{ width: 64, alignItems: "flex-end", paddingRight: 8 }}>{right}</View>
    </View>
  );
}

export function Brand({ large, light }: { large?: boolean; light?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: large ? "center" : "flex-start" }}>
      <View
        style={[
          { flexDirection: "row", alignItems: "center", gap: 8 },
          large && { flexDirection: "column", gap: 6 },
        ]}
      >
        <Svg width={large ? 72 : 26} height={large ? 64 : 24} viewBox="0 0 60 56">
          <Path
            d="M11 25a20 20 0 0 1 39 0"
            stroke="#DAB557"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <Path d="m3 48 13-17 6 7 13-21 22 31H45l-10-14-11 17-8-10-6 7Z" fill="#DAB557" />
          <Path d="m24 37 11-20 22 31H45L35 34l-5 8Z" fill="#E7D5A4" />
        </Svg>
        <Text
          style={{
            ...(large ? type.title1 : type.headline),
            color: light ? "#fff" : c.label,
          }}
        >
          Geo<Text style={{ color: "#C79935" }}>Mineral</Text>
        </Text>
      </View>
    </View>
  );
}

export { default as MineralArt } from "./MineralArt";

export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const { ui } = useTheme();
  return (
    <View style={[ui.card, { alignItems: "center", paddingVertical: 32, gap: 8 }]}>
      <Text style={ui.h3}>{title}</Text>
      {!!description && <Text style={[ui.body, { textAlign: "center" }]}>{description}</Text>}
      {!!children && <View style={{ alignSelf: "stretch", marginTop: 8 }}>{children}</View>}
    </View>
  );
}

/** Grouped list row (Settings-style). */
export function Row({
  title,
  detail,
  onPress,
  icon,
  last,
  accessibilityLabel,
}: {
  title: string;
  detail?: string;
  onPress?: () => void;
  icon?: ReactNode;
  last?: boolean;
  accessibilityLabel?: string;
}) {
  const { c, ui } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingLeft: 16,
        backgroundColor: pressed && onPress ? c.fill : "transparent",
      })}
    >
      {icon}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 13,
          paddingRight: 16,
          borderBottomWidth: last ? 0 : 0.5,
          borderColor: c.separator,
        }}
      >
        <Text style={[ui.text, { flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
        {!!detail && (
          <Text style={[ui.body, { maxWidth: "55%" }]} numberOfLines={1}>
            {detail}
          </Text>
        )}
        {onPress && <Text style={{ color: c.tertiary, fontSize: 20, marginTop: -2 }}>›</Text>}
      </View>
    </Pressable>
  );
}
