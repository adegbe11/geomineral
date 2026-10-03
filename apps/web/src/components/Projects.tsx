"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  FolderOpen,
  LockKeyhole,
  MapPin,
  Plus,
} from "lucide-react";
import { api, coordinates, post } from "@/lib/api";
import type { Analysis, Project, User } from "@/lib/types";
import Modal from "./Modal";
import { Empty } from "./AnalysisPanel";

export default function Projects({
  user,
  signIn,
  explore,
  notify,
}: {
  user: User | null;
  signIn: () => void;
  explore: () => void;
  notify: (s: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]),
    [selected, setSelected] = useState<Project | null>(null),
    [form, setForm] = useState<"sample" | "observation" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [report, setReport] = useState<{
    project: Project;
    owner: string;
    analysis: Analysis | null;
    notice: string;
  } | null>(null);
  useEffect(() => {
    if (user)
      api<Project[]>("/projects")
        .then(setProjects)
        .catch((e) => setError(e.message));
  }, [user]);
  async function open(project: Project) {
    try {
      setSelected(await api<Project>(`/projects/${project.id}`));
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function addRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await post(`/projects/${selected.id}/records`, {
        kind: form,
        title: data.get("title"),
        description: data.get("description"),
        rock_type: data.get("rock_type") || "",
        method: data.get("method") || "",
        chain_of_custody: data.get("chain") || "",
        location: {
          name: selected.location.name,
          lat: Number(data.get("lat")),
          lng: Number(data.get("lng")),
        },
      });
      await open(selected);
      setForm(null);
      notify("Field record saved privately.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function getReport() {
    if (selected)
      try {
        setReport(await api(`/projects/${selected.id}/report`));
      } catch (e) {
        notify((e as Error).message);
      }
  }
  if (!user)
    return (
      <section className="page-section">
        <div className="eyebrow">YOUR FIELD WORKSPACE</div>
        <h1>
          Good exploration starts
          <br />
          with a record.
        </h1>
        <div className="card auth-prompt">
          <LockKeyhole size={34} />
          <h2>A private place for your discoveries.</h2>
          <p>
            Save locations, outline project areas, and keep observations and
            samples together.
          </p>
          <button className="primary" onClick={signIn}>
            Create your account <ArrowUpRight size={17} />
          </button>
        </div>
      </section>
    );
  if (report)
    return (
      <section className="report">
        <div className="report-actions">
          <button className="secondary" onClick={() => setReport(null)}>
            <ArrowLeft size={16} />
            Back to project
          </button>
          <button className="primary" onClick={() => window.print()}>
            <FileText size={16} />
            Print / save PDF
          </button>
        </div>
        <div className="eyebrow">GEOMINERAL · GEOLOGICAL SUMMARY</div>
        <h1>{report.project.name}</h1>
        <p>
          Prepared for {report.owner} · {new Date().toLocaleDateString()}
        </p>
        <p>{coordinates(report.project.location)} · Private project</p>
        {report.project.area_m2 && (
          <p>Project area: {(report.project.area_m2 / 1e6).toFixed(3)} km²</p>
        )}
        <hr />
        <h2>Geological context</h2>
        <p>
          {report.analysis?.summary ||
            "No completed geological assessment is attached to this project."}
        </p>
        <h2>Mineral candidates</h2>
        {report.analysis?.assessments.length ? (
          report.analysis.assessments.map((a) => (
            <div key={a.commodity}>
              <h3>{a.commodity}</h3>
              <p>
                Prospectivity: {a.prospectivity} · Evidence quality:{" "}
                {a.evidence_quality}
              </p>
              <p>{a.explanation}</p>
              <p>Missing: {a.missing.join("; ")}.</p>
            </div>
          ))
        ) : (
          <p>Insufficient evidence to generate mineral candidates.</p>
        )}
        <h2>Coverage and sources</h2>
        {report.analysis?.providers.map((p) => (
          <div key={p.source.id}>
            <h3>
              {p.source.provider_name} · {p.status}
            </h3>
            <p>
              {p.source.dataset_name} · {p.source.resolution}
            </p>
            <p>
              {p.source.licence} · Retrieved {p.retrieved_at}
            </p>
            <a href={p.source.source_url}>{p.source.source_url}</a>
          </div>
        ))}
        <h2>Field observations and samples</h2>
        {report.project.records?.length ? (
          report.project.records.map((r) => (
            <div key={r.id}>
              <h3>
                {r.title} · {r.kind}
              </h3>
              <p>{r.description}</p>
              <p>
                {coordinates(r.location)} · {r.created_at} · Private, unverified
              </p>
            </div>
          ))
        ) : (
          <p>No field records have been added.</p>
        )}
        <h2>Recommended next steps</h2>
        <ol>
          {(
            report.analysis?.next_steps || [
              "Review source mapping and verify land access and mineral rights before any fieldwork.",
            ]
          ).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <h2>Limitations and methodology</h2>
        {report.analysis?.limitations.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <p>
          Versioned conservative screening rules explain source records. No
          calibrated probability model, field verification, or reserve estimate
          is used. A point assessment does not characterize an entire project
          polygon.
        </p>
        <p>
          Model: {report.analysis?.model_version || "No assessment"} · Analysis
          date: {report.analysis?.created_at || "Not available"}
        </p>
        <p className="mono break">
          Evidence snapshot:{" "}
          {report.analysis?.evidence_fingerprint || "Not available"}
        </p>
        <p>{report.notice}</p>
      </section>
    );
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <div className="eyebrow">YOUR FIELD WORKSPACE</div>
          <h1>{selected ? selected.name : "My projects"}</h1>
          <p>
            {selected
              ? coordinates(selected.location)
              : "Every observation adds to the bigger picture."}
          </p>
        </div>
        <button className="primary" onClick={explore}>
          <Plus size={17} />
          New project
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {selected ? (
        <>
          <button className="text-button" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} />
            All projects
          </button>
          <div className="project-overview card">
            <div>
              <span className="badge">
                <LockKeyhole size={12} />
                Private
              </span>
              <h3>{selected.location.name}</h3>
              <p>
                {selected.area_m2
                  ? `${(selected.area_m2 / 1e6).toFixed(3)} km² project area`
                  : "Saved point location"}
              </p>
            </div>
            <button className="secondary" onClick={getReport}>
              <FileText size={17} />
              Generate summary report
            </button>
          </div>
          <div className="section-heading">
            <h2>Field notebook</h2>
            <div className="button-row">
              <button
                className="secondary"
                onClick={() => setForm("observation")}
              >
                <Plus size={16} />
                Observation
              </button>
              <button className="primary" onClick={() => setForm("sample")}>
                <Plus size={16} />
                Sample
              </button>
            </div>
          </div>
          {selected.records?.length ? (
            <div className="stack">
              {selected.records.map((r) => (
                <article className="card" key={r.id}>
                  <div className="card-title">
                    <h3>{r.title}</h3>
                    <span className="badge neutral">{r.kind} · unverified</span>
                  </div>
                  <p>{r.description}</p>
                  <small>
                    {coordinates(r.location)} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Your field notebook is ready"
              text="Add your first observation or sample. Records remain private and are never treated as verified geological evidence automatically."
            />
          )}
        </>
      ) : projects.length ? (
        <div className="project-grid">
          {projects.map((p) => (
            <button className="project-card" key={p.id} onClick={() => open(p)}>
              <div className="project-card-art">
                <FolderOpen size={42} />
                <span className="badge">
                  <LockKeyhole size={12} />
                  Private
                </span>
              </div>
              <div className="project-card-content">
                <h3>
                  {p.name}
                  <ArrowUpRight size={18} />
                </h3>
                <p>
                  <MapPin size={14} />
                  {p.location.name.split(",").slice(0, 2).join(",")}
                </p>
                <small>
                  {new Date(p.created_at).toLocaleDateString()} ·{" "}
                  {p.area_m2
                    ? `${(p.area_m2 / 1e6).toFixed(2)} km²`
                    : "Point location"}
                </small>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="Room for your next question"
          text="Choose a location in Explore, run an analysis, and save it as your first private project."
        />
      )}
      {form && selected && (
        <Modal
          title={
            form === "sample"
              ? "Create a sample record"
              : "Record an observation"
          }
          close={() => setForm(null)}
        >
          <form className="form-stack" onSubmit={addRecord}>
            <label>
              {form === "sample" ? "Sample ID" : "Observation title"}
              <input
                name="title"
                placeholder={
                  form === "sample" ? "GM-001" : "Quartz vein at outcrop"
                }
                required
                maxLength={120}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                placeholder="Describe what you observed, without assuming composition."
                required
                maxLength={10000}
              />
            </label>
            <div className="form-two">
              <label>
                Latitude
                <input
                  name="lat"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  defaultValue={selected.location.lat}
                  required
                />
              </label>
              <label>
                Longitude
                <input
                  name="lng"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  defaultValue={selected.location.lng}
                  required
                />
              </label>
            </div>
            {form === "sample" && (
              <>
                <label>
                  Rock type (if known)
                  <input name="rock_type" />
                </label>
                <label>
                  Sampling method
                  <input name="method" />
                </label>
                <label>
                  Chain-of-custody notes
                  <textarea name="chain" />
                </label>
              </>
            )}
            <div className="notice">
              <LockKeyhole size={16} />
              <span>
                Private, unverified record. Record only legally collected
                samples.
              </span>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save field record"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
