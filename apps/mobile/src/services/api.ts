import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { User } from "../types";
const configured = process.env.EXPO_PUBLIC_API_ORIGIN;
export const API_ORIGIN =
  configured ||
  (__DEV__
    ? Platform.OS === "android"
      ? "http://10.0.2.2:8000"
      : "http://127.0.0.1:8000"
    : "");
/** The server could not be reached (offline, timeout, DNS). */
export class NetworkError extends Error {}
let token: string | null = null,
  guest: string | null = null;
export async function getStored(key: string) {
  return Platform.OS === "web"
    ? globalThis.sessionStorage?.getItem(key) || null
    : SecureStore.getItemAsync(key);
}
export async function setStored(key: string, value: string | null) {
  if (Platform.OS === "web") {
    if (value === null) globalThis.sessionStorage?.removeItem(key);
    else globalThis.sessionStorage?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}
export async function restoreSession() {
  token = await getStored("gm-native-session");
  guest = await getStored("gm-native-guest");
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!API_ORIGIN || (!__DEV__ && !API_ORIGIN.startsWith("https://")))
    throw new Error(
      "Your workspace connection is not configured. Please contact support.",
    );
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api${path}`, {
      ...options,
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(guest ? { "X-Guest-Token": guest } : {}),
        ...options.headers,
      },
      signal: options.signal || AbortSignal.timeout(25000),
    });
  } catch {
    throw new NetworkError(
      "Could not reach your workspace. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    let message =
      response.status === 401
        ? "Please sign in to continue."
        : "This request could not be completed. Please try again.";
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail[0].msg;
    } catch {}
    throw new Error(message);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export async function authenticate(
  mode: "login" | "register",
  email: string,
  password: string,
): Promise<User> {
  const result = await post<User & { token: string }>(`/mobile/auth/${mode}`, {
    email,
    password,
  });
  await setStored("gm-native-session", result.token);
  token = result.token;
  const { token: ignored, ...user } = result;
  return user;
}
export async function ensureGuest() {
  if (token || guest) return;
  const result = await post<{ token: string }>("/mobile/guest", {});
  guest = result.token;
  await setStored("gm-native-guest", guest);
}
export async function signOut() {
  await post("/auth/logout", {});
  token = null;
  await setStored("gm-native-session", null);
}
export function coordinates(p: { lat: number; lng: number }) {
  return `${Math.abs(p.lat).toFixed(4)}° ${p.lat < 0 ? "S" : "N"}, ${Math.abs(p.lng).toFixed(4)}° ${p.lng < 0 ? "W" : "E"}`;
}
