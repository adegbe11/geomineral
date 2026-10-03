import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { flush, pending } from "../services/outbox";
import {
  api,
  ensureGuest,
  getStored,
  restoreSession,
  setStored,
} from "../services/api";
import type { Analysis, Location, Run, ScanResult, Tab, User } from "../types";
export const initialLocation: Location = {
  lat: 6.98,
  lng: 6.12,
  name: "Uhonmora, Edo State, Nigeria",
  country_code: "NG",
};
// Names that are only coordinates or placeholders get a reverse lookup.
const UNNAMED =
  /^(-?\d+(\.\d+)?, ?-?\d+(\.\d+)?|Selected map location|Current location)$/;
// The sample being written up on Scan; kept here so switching tabs never loses it.
export type ScanDraft = {
  title: string;
  notes: string;
  mineralQuery: string;
  suspected: string;
  audio: string | null;
  gps: Location | null;
};
export const EMPTY_DRAFT: ScanDraft = {
  title: "Field rock sample",
  notes: "",
  mineralQuery: "",
  suspected: "",
  audio: null,
  gps: null,
};
function useWorkspaceState() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [welcomed, setWelcomed] = useState(false),
    [tab, setTab] = useState<Tab>("Home"),
    [professional, setProfessional] = useState(false),
    [radius, setRadius] = useState(25),
    [scanPhotos, setScanPhotos] = useState<string[]>([]),
    [scanResult, setScanResult] = useState<ScanResult | null>(null),
    [scanReview, setScanReview] = useState(false),
    [scanDraft, setScanDraft] = useState<ScanDraft>(EMPTY_DRAFT),
    [pendingCount, setPendingCount] = useState(() => pending().length);
  const [location, setLocation] = useState<Location>(initialLocation),
    [polygon, setPolygon] = useState<number[][]>([]),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [runId, setRunId] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const [recent, setRecent] = useState<
    { id: string; location: Location; result: Analysis }[]
  >([]);
  const pendingName = useRef<Location | null>(null);
  const generation = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await restoreSession();
        const seen = await getStored("gm-welcomed");
        if (mounted) {
          setWelcomed(seen === "yes");
          setReady(true);
        }
        const me = await api<User | null>("/auth/me");
        if (mounted) setUser(me);
      } catch {
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
      generation.current++;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  async function sync() {
    if (pending().length && (await flush())) setPendingCount(pending().length);
    else setPendingCount(pending().length);
  }
  useEffect(() => {
    if (!user) return;
    void sync();
    const timer = setInterval(() => pending().length && void sync(), 30000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && void sync());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [user]);
  function selectLocation(point: Location) {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    setLocation(point);
    setPolygon([]);
    setAnalysis(null);
    setRunId("");
    setStatus("");
    setError("");
    if (UNNAMED.test(point.name)) {
      api<Location>(`/reverse?lat=${point.lat}&lng=${point.lng}`)
        .then((place) => {
          if (UNNAMED.test(place.name)) return;
          // Same point only; an analysis started meanwhile keeps its result.
          const same = (l: Location) => l.lat === point.lat && l.lng === point.lng;
          const named = (l: Location) =>
            same(l) ? { ...l, name: place.name, country_code: place.country_code } : l;
          setLocation(named);
          setRecent((old) => old.map((r) => ({ ...r, location: named(r.location) })));
          pendingName.current = same(point) ? place : null;
        })
        .catch(() => {});
    }
  }
  async function welcome() {
    setWelcomed(true);
    await setStored("gm-welcomed", "yes");
  }
  async function analyze(point: Location = location) {
    const version = ++generation.current;
    setStatus("queued");
    setError("");
    setAnalysis(null);
    try {
      await ensureGuest();
      const run = await api<Run>("/analyses", {
        method: "POST",
        body: JSON.stringify({ location: point, radius_km: radius }),
      });
      if (generation.current !== version) return;
      setRunId(run.id);
      const start = Date.now();
      const poll = async () => {
        try {
          const next = await api<Run>(`/analyses/${run.id}`);
          if (generation.current !== version) return;
          setStatus(next.status);
          if (next.status === "complete" && next.result) {
            setAnalysis(next.result);
            const named =
              pendingName.current &&
              pendingName.current.lat === point.lat &&
              pendingName.current.lng === point.lng
                ? { ...point, name: pendingName.current.name }
                : point;
            setRecent((old) =>
              [
                { id: run.id, location: named, result: next.result! },
                ...old.filter((r) => r.location.lat !== point.lat || r.location.lng !== point.lng),
              ].slice(
                0,
                8,
              ),
            );
            return;
          }
          if (next.status === "failed")
            throw new Error(next.error || "Analysis could not be completed.");
          if (Date.now() - start > 120000)
            throw new Error(
              "This analysis is taking longer than expected. Try again shortly.",
            );
          timer.current = setTimeout(poll, 1400);
        } catch (e) {
          if (generation.current === version) {
            setError((e as Error).message);
            setStatus("failed");
          }
        }
      };
      await poll();
    } catch (e) {
      if (generation.current === version) {
        setError((e as Error).message);
        setStatus("failed");
      }
    }
  }
  function openRecent(id: string) {
    const found = recent.find((r) => r.id === id);
    if (!found) return;
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    setLocation(found.location);
    setPolygon([]);
    setAnalysis(found.result);
    setRunId(found.id);
    setStatus("complete");
    setError("");
  }
  function clearPrivateState() {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    setUser(null);
    setRecent([]);
    setScanPhotos([]);
    setScanResult(null);
    setScanReview(false);
    setScanDraft(EMPTY_DRAFT);
    setAnalysis(null);
    setRunId("");
    setStatus("");
    setError("");
  }
  return {
    user,
    setUser,
    ready,
    welcomed,
    welcome,
    tab,
    setTab,
    professional,
    setProfessional,
    location,
    selectLocation,
    radius,
    setRadius,
    scanPhotos,
    setScanPhotos,
    scanResult,
    setScanResult,
    scanReview,
    setScanReview,
    scanDraft,
    setScanDraft,
    pendingCount,
    refreshPending: () => setPendingCount(pending().length),
    sync,
    polygon,
    setPolygon,
    analysis,
    setAnalysis,
    runId,
    setRunId,
    status,
    error,
    analyze,
    recent,
    openRecent,
    clearPrivateState,
  };
}
const Context = createContext<ReturnType<typeof useWorkspaceState> | null>(
  null,
);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaceState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider is missing");
  return value;
}
