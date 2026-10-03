import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  ensureGuest,
  getStored,
  restoreSession,
  setStored,
} from "../services/api";
import type { Analysis, Location, Run, Tab, User } from "../types";
export const initialLocation: Location = {
  lat: 6.98,
  lng: 6.12,
  name: "Uhonmora, Edo State, Nigeria",
  country_code: "NG",
};
function useWorkspaceState() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [welcomed, setWelcomed] = useState(false),
    [tab, setTab] = useState<Tab>("Home"),
    [professional, setProfessional] = useState(false);
  const [location, setLocation] = useState<Location>(initialLocation),
    [polygon, setPolygon] = useState<number[][]>([]),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [runId, setRunId] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const [recent, setRecent] = useState<
    { id: string; location: Location; result: Analysis }[]
  >([]);
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
  function selectLocation(point: Location) {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    setLocation(point);
    setPolygon([]);
    setAnalysis(null);
    setRunId("");
    setStatus("");
    setError("");
  }
  async function welcome() {
    setWelcomed(true);
    await setStored("gm-welcomed", "yes");
  }
  async function analyze() {
    const version = ++generation.current;
    setStatus("queued");
    setError("");
    setAnalysis(null);
    try {
      await ensureGuest();
      const run = await api<Run>("/analyses", {
        method: "POST",
        body: JSON.stringify({ location, radius_km: 25 }),
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
            setRecent((old) =>
              [{ id: run.id, location, result: next.result! }, ...old].slice(
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
  function clearPrivateState() {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    setUser(null);
    setRecent([]);
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
