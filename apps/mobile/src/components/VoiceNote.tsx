import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from "expo-audio";
import { File } from "expo-file-system";
import { Mic, Pause, Play, Square, Trash2 } from "lucide-react-native";
import { haptic, useReduceMotion } from "../motion";
import { type, useTheme } from "../theme";

const MAX_SECONDS = 120;
const native = Platform.OS !== "web";

async function toDataUri(uri: string) {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return `data:audio/mp4;base64,${new File(uri).base64Sync()}`;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Plays a stored voice note. */
export function VoicePlayer({ uri }: { uri: string }) {
  const { c, ui } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}
      onPress={() => {
        haptic.tap();
        if (status.playing) player.pause();
        else {
          if (status.duration && status.currentTime >= status.duration - 0.1) player.seekTo(0);
          player.play();
        }
      }}
      style={[ui.row, { gap: 10, padding: 10, borderRadius: 16, backgroundColor: c.tintSoft, alignSelf: "flex-start" }]}
    >
      {status.playing ? <Pause size={16} color={c.tint} /> : <Play size={16} color={c.tint} />}
      <Text style={{ ...type.subhead, fontWeight: "600", color: c.tint }}>
        Voice note · {clock(status.playing ? status.currentTime : status.duration || 0)}
      </Text>
    </Pressable>
  );
}

/** Records up to two minutes and hands back a data URI. */
export default function VoiceNote({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (audio: string | null) => void;
}) {
  const { c, ui } = useTheme();
  const still = useReduceMotion();
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [error, setError] = useState("");
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    const loop = still
      ? null
      : Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: native }),
            Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: native }),
          ]),
        );
    loop?.start();
    return () => {
      clearInterval(t);
      loop?.stop();
    };
  }, [recording]);
  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) void stop();
  }, [seconds]);
  async function start() {
    setError("");
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Microphone access is off.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic.heavy();
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      setError((e as Error).message || "Could not start recording.");
    }
  }
  async function stop() {
    try {
      await recorder.stop();
      setRecording(false);
      haptic.success();
      await setAudioModeAsync({ allowsRecording: false });
      if (recorder.uri) onChange(await toDataUri(recorder.uri));
    } catch (e) {
      setRecording(false);
      setError((e as Error).message || "Could not save the recording.");
    }
  }
  if (value && !recording)
    return (
      <View style={[ui.row, { gap: 10 }]}>
        <VoicePlayer uri={value} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete voice note"
          hitSlop={10}
          onPress={() => onChange(null)}
        >
          <Trash2 size={18} color={c.tertiary} />
        </Pressable>
      </View>
    );
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? "Stop recording" : "Record voice note"}
        onPress={recording ? stop : start}
        style={[
          ui.row,
          {
            gap: 10,
            padding: 12,
            borderRadius: 16,
            backgroundColor: recording ? "rgba(215,55,47,0.12)" : c.fill,
          },
        ]}
      >
        {recording ? (
          <>
            <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger, opacity: pulse }} />
            <Text style={{ ...type.subhead, fontWeight: "600", color: c.danger, flex: 1 }}>
              Recording {clock(seconds)}
            </Text>
            <Square size={16} color={c.danger} fill={c.danger} />
          </>
        ) : (
          <>
            <Mic size={18} color={c.tint} />
            <Text style={{ ...type.subhead, fontWeight: "600", color: c.label }}>Record voice note</Text>
          </>
        )}
      </Pressable>
      {!!error && <Text style={[ui.caption, { color: c.danger }]}>{error}</Text>}
    </View>
  );
}
