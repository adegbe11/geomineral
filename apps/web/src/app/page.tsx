"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  Check,
  Compass,
  FolderOpen,
  Globe2,
  Layers,
  Loader2,
  LockKeyhole,
  MapPin,
  Mountain,
  Plus,
  Settings2,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { api, coordinates, post } from "@/lib/api";
import type {
  Analysis,
  Location,
  Project,
  Run,
  Source,
  User,
} from "@/lib/types";
import Search from "@/components/Search";
import Modal from "@/components/Modal";
import AnalysisPanel from "@/components/AnalysisPanel";
import Projects from "@/components/Projects";
import RockScanner from "@/components/RockScanner";
import { Sidebar, Topbar } from "@/components/AppNavigation";
const GeoMap = dynamic(() => import("@/components/GeoMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <Globe2 size={35} />
      <p>Preparing your view of Earth…</p>
    </div>
  ),
});
const START_LOCATION: Location = {
  lat: -30.7489,
  lng: 121.4658,
  name: "Kalgoorlie, Western Australia",
  country_code: "AU",
};
const DESTINATIONS: (Location & {
  label: string;
  code: string;
  style: string;
})[] = [
  {
    ...START_LOCATION,
    label: "Western Australia",
    code: "AU",
    style: "australia",
  },
  {
    lat: -22.315,
    lng: -68.929,
    name: "Calama, Antofagasta, Chile",
    country_code: "CL",
    label: "Atacama, Chile",
    code: "CL",
    style: "chile",
  },
  {
    lat: 46.49,
    lng: -80.99,
    name: "Sudbury, Ontario, Canada",
    country_code: "CA",
    label: "Ontario, Canada",
    code: "CA",
    style: "canada",
  },
];
const MINERALS = [
  {
    name: "Gold",
    symbol: "Au",
    color: "gold",
    text: "Gold occurs in several geological systems. A nearby record cannot establish its presence at a selected point.",
  },
  {
    name: "Copper",
    symbol: "Cu",
    color: "copper",
    text: "Copper exploration depends on geological setting, alteration and geochemistry. Color alone does not identify copper minerals.",
  },
  {
    name: "Lithium",
    symbol: "Li",
    color: "lithium",
    text: "Lithium exploration includes distinct geological settings. A rock photograph cannot measure lithium content.",
  },
  {
    name: "Iron",
    symbol: "Fe",
    color: "iron",
    text: "Iron-rich materials are common. Their presence does not establish an economically recoverable resource.",
  },
  {
    name: "Limestone",
    symbol: "Ca",
    color: "lime",
    text: "Mapped limestone provides a candidate for local investigation. Composition, purity and suitability require testing.",
  },
];

export default function Dashboard() {
  const [view, setView] = useState("Home"),
    [professional, setProfessional] = useState(false),
    [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState<Location>(START_LOCATION),
    [polygon, setPolygon] = useState<number[][]>([]),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [runId, setRunId] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const [auth, setAuth] = useState<"login" | "register" | null>(null),
    [authError, setAuthError] = useState(""),
    [authBusy, setAuthBusy] = useState(false),
    [save, setSave] = useState(false),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState("");
  const [guide, setGuide] = useState<(typeof MINERALS)[number] | null>(null),
    [sources, setSources] = useState<Source[]>([]),
    [recent, setRecent] = useState<
      { location: Location; date: string; id: string }[]
    >([]);
  const requestVersion = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    api<User | null>("/auth/me")
      .then(setUser)
      .catch(() => {});
    return () => {
      requestVersion.current++;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (view === "Sources")
      api<Source[]>("/datasets")
        .then(setSources)
        .catch((e) => setError(e.message));
  }, [view]);
  function select(next: Location) {
    requestVersion.current++;
    if (timer.current) clearTimeout(timer.current);
    setLocation(next);
    setPolygon([]);
    setAnalysis(null);
    setRunId("");
    setStatus("");
    setError("");
  }
  async function analyze() {
    const version = ++requestVersion.current;
    setStatus("queued");
    setError("");
    setAnalysis(null);
    setView("Explore");
    try {
      const run = await post<Run>("/analyses", { location, radius_km: 25 });
      if (version !== requestVersion.current) return;
      setRunId(run.id);
      const started = Date.now();
      const poll = async () => {
        if (version !== requestVersion.current) return;
        try {
          const current = await api<Run>(`/analyses/${run.id}`);
          if (version !== requestVersion.current) return;
          setStatus(current.status);
          if (current.status === "complete" && current.result) {
            setAnalysis(current.result);
            setRecent((prev) =>
              [
                { location, date: new Date().toISOString(), id: run.id },
                ...prev,
              ].slice(0, 5),
            );
            return;
          }
          if (current.status === "failed") {
            setError(current.error || "Analysis could not be completed.");
            return;
          }
          if (Date.now() - started > 120000) {
            setStatus("");
            setError(
              "The analysis is taking longer than expected. The queued job is retained; verify that the analysis worker is running.",
            );
            return;
          }
          timer.current = setTimeout(poll, 1200);
        } catch (e) {
          setStatus("");
          setError((e as Error).message);
        }
      };
      await poll();
    } catch (e) {
      if (version === requestVersion.current) {
        setStatus("");
        setError((e as Error).message);
      }
    }
  }
  async function authenticate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      setUser(
        await post<User>(`/auth/${auth}`, {
          email: data.get("email"),
          password: data.get("password"),
        }),
      );
      setAuth(null);
      setNotice("Your private workspace is ready.");
    } catch (e) {
      setAuthError((e as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }
  function openSave() {
    if (!user) {
      setAuth("register");
      setNotice(
        "Create an account, then save this location to your private project.",
      );
    } else {
      setError("");
      setSave(true);
    }
  }
  async function saveProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      await post<Project>("/projects", {
        name: data.get("name"),
        location,
        analysis_id: runId || null,
        polygon: polygon.length >= 3 ? polygon : null,
      });
      setSave(false);
      setView("Projects");
      setNotice("Project saved. Only your account can access it.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function toggleSource(source: Source) {
    try {
      await api(`/admin/datasets/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: source.status !== "enabled" }),
      });
      setSources(await api("/datasets"));
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  const busy = status === "queued" || status === "processing";
  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} user={user} setAuth={setAuth} />
      <div className="main-shell">
        <Topbar
          view={view}
          setView={setView}
          user={user}
          setAuth={setAuth}
          professional={professional}
          setProfessional={setProfessional}
        />
        <main>
          {(view === "Home" || view === "Explore") && (
            <div className="exploration-page">
              {view === "Home" ? (
                <>
                  <div className="welcome-row">
                    <span>
                      <span className="tiny-dot" /> A NEW PERSPECTIVE ON OUR
                      PLANET
                    </span>
                    <span>CURIOUS BY NATURE.</span>
                  </div>
                  <div className="hero-heading">
                    <div>
                      <h1>
                        Explore Earth.
                        <br />
                        <span>Follow the evidence.</span>
                      </h1>
                      <p>
                        From a place on the map to the story beneath it.
                        <br />
                        Understand the geology. Discover what could be possible.
                      </p>
                    </div>
                    <div className="orbital-mark" aria-hidden="true">
                      <Globe2 />
                      <span>22° 30′</span>
                    </div>
                  </div>
                  <div className="home-search-row">
                    <Search
                      select={(l) => {
                        select(l);
                        setView("Explore");
                      }}
                    />
                    <button className="primary" onClick={analyze}>
                      Analyze location <ArrowUpRight size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="section-heading explore-heading">
                  <div>
                    <div className="eyebrow">FOLLOW YOUR CURIOSITY</div>
                    <h1>Explore the Earth</h1>
                  </div>
                  <Search select={select} />
                </div>
              )}
              <div
                className={`map-workspace ${view === "Explore" ? "explore-map" : ""}`}
              >
                <GeoMap
                  location={location}
                  select={select}
                  polygon={polygon}
                  onPolygon={setPolygon}
                  occurrences={analysis?.occurrences || []}
                  expanded={view === "Explore"}
                />
                <div className="location-card">
                  <div className="location-card-top">
                    <span className="pin-box">
                      <MapPin size={21} />
                    </span>
                    <span className="eyebrow">
                      {polygon.length >= 3
                        ? "PROJECT AREA"
                        : "SELECTED LOCATION"}
                    </span>
                    <span className="badge dark">
                      {location.country_code || "PIN"}
                    </span>
                  </div>
                  <h3>{location.name.split(",")[0]}</h3>
                  <p>
                    {location.name.split(",").slice(1, 3).join(",") ||
                      "Explore the evidence at this point"}
                  </p>
                  <div className="location-coordinates">
                    {coordinates(location)}
                  </div>
                  <div className="location-card-divider" />
                  <div className="location-help">
                    <Layers size={16} />
                    <span>
                      {polygon.length >= 3
                        ? `${polygon.length} vertices · Save as a project area`
                        : "A place to start asking better questions."}
                    </span>
                  </div>
                  <button className="primary" onClick={analyze} disabled={busy}>
                    {busy ? (
                      <>
                        <Loader2 className="spin" size={17} />
                        {status === "queued"
                          ? "Queued…"
                          : "Gathering evidence…"}
                      </>
                    ) : (
                      <>
                        Analyze this location <ArrowUpRight size={17} />
                      </>
                    )}
                  </button>
                  {view === "Explore" && (
                    <button className="save-location" onClick={openSave}>
                      <Plus size={15} />
                      Save {polygon.length >= 3 ? "project area" : "location"}
                    </button>
                  )}
                </div>
              </div>
              <div className="map-caption">
                <span>
                  <ShieldCheck size={15} />
                  Insight, not certainty. Always grounded in available evidence.
                </span>
                <span>
                  <span className="tiny-dot" /> GLOBAL DATA · LOCAL CONTEXT
                </span>
              </div>
              {error && (
                <div role="alert" className="form-error card">
                  {error}
                </div>
              )}
              {busy && (
                <div className="progress-card">
                  <Loader2 className="spin" size={23} />
                  <div>
                    <strong>
                      {status === "queued"
                        ? "Your analysis is queued"
                        : "Building your geological context"}
                    </strong>
                    <p>
                      Checking geological maps and reported occurrences.
                      Coverage gaps will remain visible.
                    </p>
                  </div>
                </div>
              )}
              {analysis && view === "Explore" && (
                <AnalysisPanel
                  analysis={analysis}
                  professional={professional}
                  save={openSave}
                />
              )}
              {view === "Home" && (
                <>
                  <div className="quick-actions">
                    {[
                      {
                        icon: Compass,
                        title: "Map explorer",
                        text: "See the bigger picture",
                        next: "Explore",
                      },
                      {
                        icon: Camera,
                        title: "Identify a rock",
                        text: "Start with a closer look",
                        next: "Scan",
                      },
                      {
                        icon: FolderOpen,
                        title: "My projects",
                        text: "Build your field notebook",
                        next: "Projects",
                      },
                      {
                        icon: BookOpen,
                        title: "Mineral guide",
                        text: "Let curiosity lead",
                        next: "Guide",
                      },
                    ].map((a) => (
                      <button key={a.title} onClick={() => setView(a.next)}>
                        <span className="quick-icon">
                          <a.icon size={22} />
                        </span>
                        <span>
                          <strong>{a.title}</strong>
                          <small>{a.text}</small>
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                  </div>
                  <div className="section-heading destination-heading">
                    <div>
                      <div className="eyebrow">
                        THERE&apos;S A WHOLE WORLD TO UNDERSTAND
                      </div>
                      <h2>Where will your curiosity take you?</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setView("Explore")}
                    >
                      Explore the map <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="destination-grid">
                    {DESTINATIONS.map((d) => (
                      <button
                        className={`destination ${d.style}`}
                        key={d.code}
                        onClick={() => {
                          select(d);
                          setView("Explore");
                        }}
                      >
                        <div className="terrain-lines" />
                        <span className="destination-code">
                          {d.code} <ArrowUpRight size={16} />
                        </span>
                        <div>
                          <small>A PLACE TO EXPLORE</small>
                          <h3>{d.label}</h3>
                          <p>{coordinates(d)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mineral-strip">
                    <span>Get to know the minerals</span>
                    {MINERALS.map((m) => (
                      <button key={m.name} onClick={() => setGuide(m)}>
                        <span className={`mineral-dot ${m.color}`} />
                        {m.name}
                        <ArrowUpRight size={12} />
                      </button>
                    ))}
                    <button
                      className="all-minerals"
                      onClick={() => setView("Guide")}
                    >
                      View guide <ArrowRight size={14} />
                    </button>
                  </div>
                  {recent.length > 0 && (
                    <section className="recent">
                      <h2>Recent analyses</h2>
                      {recent.map((r) => (
                        <button
                          key={r.id}
                          onClick={async () => {
                            select(r.location);
                            setView("Explore");
                            try {
                              const run = await api<Run>(`/analyses/${r.id}`);
                              setAnalysis(run.result || null);
                              setRunId(r.id);
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          <MapPin size={18} />
                          <span>{r.location.name}</span>
                          <small>{new Date(r.date).toLocaleDateString()}</small>
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                    </section>
                  )}
                </>
              )}
            </div>
          )}
          {view === "Projects" && (
            <Projects
              user={user}
              signIn={() => setAuth("register")}
              explore={() => setView("Explore")}
              notify={setNotice}
            />
          )}
          {view === "Scan" && <RockScanner />}
          {view === "Guide" && (
            <section className="page-section">
              <div className="eyebrow">
                A LITTLE KNOWLEDGE. A NEW PERSPECTIVE.
              </div>
              <h1>Get to know the minerals.</h1>
              <p className="page-intro">
                Educational starting points, not detection capabilities. Learn
                what evidence can—and cannot—tell you.
              </p>
              <div className="guide-grid">
                {MINERALS.map((m) => (
                  <button
                    className="card mineral-card"
                    key={m.name}
                    onClick={() => setGuide(m)}
                  >
                    <span className={`element-symbol ${m.color}`}>
                      {m.symbol}
                    </span>
                    <h2>{m.name}</h2>
                    <p>{m.text}</p>
                    <span className="text-button">
                      Follow the evidence <ArrowUpRight size={17} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {view === "Sources" && (
            <section className="page-section">
              <div className="eyebrow">TRANSPARENCY IS PART OF THE PRODUCT</div>
              <h1>Evidence you can trace.</h1>
              <p className="page-intro">
                Connected source adapters retain citations, licence metadata and
                retrieval dates. Provider availability varies by location.
              </p>
              <div className="notice">
                <ShieldCheck size={21} />
                <span>
                  Our current engine uses conservative screening rules. There is
                  no calibrated deposit probability model. Public map data
                  cannot establish mineral rights or economic viability.
                </span>
              </div>
              <div className="stack">
                {sources.map((s) => (
                  <article className="card" key={s.id}>
                    <div className="card-title">
                      <h2>{s.provider_name}</h2>
                      <span className="badge">{s.status}</span>
                    </div>
                    <p>{s.dataset_name}</p>
                    <p className="muted">{s.notes}</p>
                    <dl className="metadata">
                      <div>
                        <dt>Licence</dt>
                        <dd>{s.licence}</dd>
                      </div>
                      <div>
                        <dt>Resolution</dt>
                        <dd>{s.resolution}</dd>
                      </div>
                    </dl>
                    <div className="button-row">
                      <a
                        href={s.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-button"
                      >
                        Original source <ArrowUpRight size={16} />
                      </a>
                      {user?.is_admin && (
                        <button
                          className="secondary"
                          onClick={() => toggleSource(s)}
                        >
                          {s.status === "enabled" ? "Disable" : "Enable"}{" "}
                          provider
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <p className="muted">
                Place search: © OpenStreetMap contributors, ODbL. Imagery
                attribution is displayed on the map. Additional geological
                overlays, regulatory datasets and photo identification are not
                yet connected.
              </p>
            </section>
          )}
          {view === "Profile" && (
            <section className="page-section">
              <div className="eyebrow">YOUR WORKSPACE</div>
              <h1>Made for your curiosity.</h1>
              <article className="card profile-card">
                <UserRound size={32} />
                <h2>{user?.email}</h2>
                <p>
                  {user?.is_admin ? "Administrator" : "Explorer"} · Private
                  projects by default
                </p>
                <h3>Explanation level</h3>
                <p>
                  {professional
                    ? "Professional mode includes raw evidence and reproducibility metadata."
                    : "Simple mode uses plain language and keeps limitations visible."}
                </p>
                <button
                  className="secondary"
                  onClick={() => setProfessional(!professional)}
                >
                  <Settings2 size={17} />
                  Use {professional ? "Simple" : "Professional"} mode
                </button>
                <hr />
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await post("/auth/logout", {});
                      setUser(null);
                      setAnalysis(null);
                      setRunId("");
                      setRecent([]);
                      setView("Home");
                    } catch (e) {
                      setNotice((e as Error).message);
                    }
                  }}
                >
                  Sign out <ArrowRight size={16} />
                </button>
              </article>
            </section>
          )}
        </main>
        <footer className="footer">
          <span>
            <Mountain size={15} /> GeoMineral{" "}
            <span className="footer-dot">·</span> Know what could be beneath
            you.
          </span>
          <button onClick={() => setView("Sources")}>
            Science & transparency <ArrowUpRight size={13} />
          </button>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {auth && (
        <Modal
          title={
            auth === "register" ? "Start your exploration." : "Welcome back."
          }
          close={() => setAuth(null)}
        >
          <p className="muted">Your projects and field records stay private.</p>
          <form className="form-stack" onSubmit={authenticate}>
            <label>
              Email address
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete={
                  auth === "register" ? "new-password" : "current-password"
                }
                required
                placeholder="At least 12 characters"
              />
            </label>
            {authError && (
              <p className="form-error" role="alert">
                {authError}
              </p>
            )}
            <button className="primary" disabled={authBusy}>
              {authBusy
                ? "One moment…"
                : auth === "register"
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <button
            className="text-button auth-alternate"
            onClick={() => {
              setAuth(auth === "register" ? "login" : "register");
              setAuthError("");
            }}
          >
            {auth === "register"
              ? "Already have an account? Sign in"
              : "New to GeoMineral? Create an account"}
          </button>
        </Modal>
      )}
      {save && (
        <Modal
          title="Give your exploration a home."
          close={() => setSave(false)}
        >
          <form className="form-stack" onSubmit={saveProject}>
            <label>
              Project name
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={`${location.name.split(",")[0]} project`}
              />
            </label>
            <div className="notice">
              <LockKeyhole size={18} />
              <span>
                Private project · {coordinates(location)}
                {polygon.length >= 3 && (
                  <>
                    <br />
                    Includes the drawn project area. Drawing an area does not
                    imply ownership. The attached analysis describes the
                    selected point.
                  </>
                )}
              </span>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="primary" disabled={saving}>
              {saving ? "Saving…" : "Create private project"}
              <Plus size={17} />
            </button>
          </form>
        </Modal>
      )}
      {guide && (
        <Modal title={guide.name} close={() => setGuide(null)}>
          <span className={`element-symbol ${guide.color}`}>
            {guide.symbol}
          </span>
          <p className="body-copy">{guide.text}</p>
          <h3>Follow the evidence</h3>
          <p>
            Start with geological maps and documented records. Distinguish a
            reported occurrence from an observation on your project area. Local
            sampling and professional interpretation may be needed.
          </p>
          <div className="notice">
            <InfoIcon />
            <span>
              Prospectivity is not proof of a deposit. Appearance does not
              establish grade or value.
            </span>
          </div>
          <a
            className="text-button"
            href="https://www.usgs.gov/centers/national-minerals-information-center"
            target="_blank"
            rel="noreferrer"
          >
            USGS mineral information <ArrowUpRight size={16} />
          </a>
        </Modal>
      )}
    </div>
  );
}
function InfoIcon() {
  return <ShieldCheck size={19} />;
}
