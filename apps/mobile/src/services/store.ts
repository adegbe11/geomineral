import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

// Small JSON documents kept on the device: app files natively, localStorage on web.
export function readJSON<T>(key: string, fallback: T): T {
  try {
    if (Platform.OS === "web") {
      const raw = globalThis.localStorage?.getItem(`gm-${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }
    const file = new File(Paths.document, `${key}.json`);
    return file.exists ? (JSON.parse(file.textSync()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    const raw = JSON.stringify(value);
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(`gm-${key}`, raw);
      return;
    }
    const file = new File(Paths.document, `${key}.json`);
    if (!file.exists) file.create();
    file.write(raw);
  } catch {
    // Storage full or unavailable; the caller keeps working online.
  }
}
