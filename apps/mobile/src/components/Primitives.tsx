import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ArrowLeft, ArrowRight, Info } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { colors, ui } from "../theme";
export function Button({
  title,
  onPress,
  outline,
  busy,
  icon,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  outline?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        outline && styles.outline,
        {
          opacity: disabled || busy ? 0.65 : 1,
          transform: [{ scale: pressed ? 0.975 : 1 }],
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={outline ? colors.green : "#fff"} />
      ) : (
        icon
      )}
      <Text style={[styles.buttonText, outline && { color: colors.green }]}>
        {title}
      </Text>
      {!outline && !busy && <ArrowRight size={17} color="#fff" />}
    </Pressable>
  );
}
export function Header({
  title,
  back,
  right,
  dark,
}: {
  title: string;
  back?: () => void;
  right?: ReactNode;
  dark?: boolean;
}) {
  return (
    <View
      style={[
        styles.header,
        dark && {
          backgroundColor: colors.dark,
          borderBottomColor: "#ffffff0b",
        },
      ]}
    >
      <View style={{ width: 40 }}>
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={back}
            hitSlop={12}
          >
            <ArrowLeft size={22} color={dark ? "#fff" : colors.ink} />
          </Pressable>
        )}
      </View>
      <Text style={[styles.headerTitle, dark && { color: "#fff" }]}>
        {title}
      </Text>
      <View style={{ width: 40, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
export function Brand({ large, light }: { large?: boolean; light?: boolean }) {
  return (
    <View style={{ alignItems: large ? "center" : "flex-start" }}>
      <View style={[ui.row, large && { flexDirection: "column", gap: 3 }]}>
        <Svg
          width={large ? 95 : 29}
          height={large ? 77 : 29}
          viewBox="0 0 60 56"
        >
          <Path
            d="M11 25a20 20 0 0 1 39 0"
            stroke="#DAB557"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="m3 48 13-17 6 7 13-21 22 31H45l-10-14-11 17-8-10-6 7Z"
            fill="#DAB557"
          />
          <Path d="m24 37 11-20 22 31H45L35 34l-5 8Z" fill="#E7D5A4" />
        </Svg>
        <Text
          style={{
            fontSize: large ? 39 : 20,
            fontWeight: "700",
            letterSpacing: large ? -1.5 : -0.8,
            color: light ? "#fff" : "#15261D",
          }}
        >
          Geo<Text style={{ color: "#C79935" }}>Mineral</Text>
        </Text>
      </View>
      {large && (
        <Text
          style={{
            color: light ? "#D0DBD5" : colors.muted,
            fontSize: 11,
            letterSpacing: 2,
            marginTop: 5,
          }}
        >
          Know what could be beneath you.
        </Text>
      )}
    </View>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Info size={16} color="#60856B" />
      <Text style={{ flex: 1, fontSize: 11, lineHeight: 18, color: "#62806A" }}>
        {children}
      </Text>
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
  return (
    <View style={[ui.card, { alignItems: "center", paddingVertical: 35 }]}>
      <Text style={ui.h2}>{title}</Text>
      {!!description && (
        <Text style={[ui.body, { textAlign: "center" }]}>{description}</Text>
      )}
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    backgroundColor: colors.green,
    borderRadius: 27,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 13,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: "#B9CABB",
    borderWidth: 1,
  },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  header: {
    height: 65,
    paddingHorizontal: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  notice: {
    backgroundColor: "#EFF5F0",
    borderRadius: 10,
    padding: 13,
    gap: 9,
    flexDirection: "row",
    alignItems: "flex-start",
  },
});
