"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  BookmarkPlus,
  Check,
  FileText,
  Info,
  Layers,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import type { Analysis } from "@/lib/types";
import { coordinates } from "@/lib/api";
export default function AnalysisPanel({
  analysis,
  professional,
  save,
}: {
  analysis: Analysis;
  professional: boolean;
  save: () => void;
}) {
  const [tab, setTab] = useState("Overview");
  return (
    <section className="analysis-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">LOCATION INTELLIGENCE</div>
          <h2>{analysis.location.name.split(",").slice(0, 2).join(",")}</h2>
          <p>
            <MapPin size={14} /> {coordinates(analysis.location)}
          </p>
        </div>
        <button className="primary" onClick={save}>
          <BookmarkPlus size={17} />
          Save to project
        </button>
      </div>
      <div className="tabs" role="tablist">
        {[
          "Overview",
          "Geology",
          "Minerals",
          "Evidence",
          "Nearby",
          "Next steps",
        ].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Overview" && (
        <div className="analysis-grid">
          <article className="card">
            <span className="mini-icon">
              <Layers size={21} />
            </span>
            <h3>Understand the geological setting</h3>
            <p className="body-copy">{analysis.summary}</p>
            <div className="notice">
              <Info size={17} />
              <span>
                Regional geology provides context. It does not confirm a deposit
                beneath this location.
              </span>
            </div>
            <button className="text-button" onClick={() => setTab("Geology")}>
              Explore the mapped units <ArrowUpRight size={16} />
            </button>
          </article>
          <article className="card">
            <div className="card-title">
              <h3>Evidence coverage</h3>
              <span className="badge neutral">{analysis.evidence_quality}</span>
            </div>
            <div className="coverage-list">
              {analysis.coverage.map((c) => (
                <div key={c.name}>
                  <span>{c.name}</span>
                  <span className={`coverage-status ${c.status}`}>
                    {c.status === "available" ? <Check size={13} /> : "—"}{" "}
                    {c.status === "empty" ? "No records" : c.status}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
      {tab === "Geology" && (
        <div className="stack">
          {analysis.evidence
            .filter((e) => e.evidence_type === "mapped_geology")
            .map((e) => (
              <article className="card" key={e.id}>
                <div className="card-title">
                  <h3>{String(e.raw_value.name || "Geological unit")}</h3>
                  <span className="badge neutral">
                    Reported · map interpretation
                  </span>
                </div>
                <p className="body-copy">{e.description}</p>
                <dl className="metadata">
                  <div>
                    <dt>Geological age</dt>
                    <dd>
                      {String(e.raw_value.best_int_name || "Not supplied")}
                    </dd>
                  </div>
                  <div>
                    <dt>Lithology</dt>
                    <dd>{String(e.raw_value.lith || "Not supplied")}</dd>
                  </div>
                  <div>
                    <dt>Original publication</dt>
                    <dd>{String(e.raw_value.publication || "Not supplied")}</dd>
                  </div>
                </dl>
                {professional && (
                  <details>
                    <summary>Raw source attributes</summary>
                    <pre>{JSON.stringify(e.raw_value, null, 2)}</pre>
                  </details>
                )}
              </article>
            ))}
          {!analysis.evidence.some(
            (e) => e.evidence_type === "mapped_geology",
          ) && (
            <Empty
              title="A gap in the geological record"
              text="Detailed mapping is currently unavailable from connected sources for this area. We won't fill the gap with a guess."
            />
          )}
        </div>
      )}
      {tab === "Minerals" && (
        <div className="stack">
          {analysis.assessments.length ? (
            analysis.assessments.map((a) => (
              <article className="card" key={a.commodity}>
                <div className="card-title">
                  <h3>{a.commodity}</h3>
                  <span className="badge">
                    Candidate · requires verification
                  </span>
                </div>
                <div className="rating-pair">
                  <div>
                    <small>PROSPECTIVITY</small>
                    <strong>{a.prospectivity}</strong>
                  </div>
                  <div>
                    <small>EVIDENCE QUALITY</small>
                    <strong>{a.evidence_quality}</strong>
                  </div>
                </div>
                <p>{a.explanation}</p>
                <h4>What&apos;s missing</h4>
                <ul>
                  {a.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <details>
                  <summary>
                    Why this potential? · {a.evidence_ids.length} evidence
                    records
                  </summary>
                  {analysis.evidence
                    .filter((e) => a.evidence_ids.includes(e.id))
                    .map((e) => (
                      <p key={e.id}>
                        {e.description}{" "}
                        <small>
                          Source: {e.source_id} · {e.observed_or_inferred}
                        </small>
                      </p>
                    ))}
                </details>
              </article>
            ))
          ) : (
            <Empty
              title="Insufficient evidence"
              text="No defensible mineral candidates could be generated from the connected records. This does not mean minerals are absent."
            />
          )}
        </div>
      )}
      {tab === "Evidence" && (
        <div className="stack">
          <div className="notice">
            <ShieldCheck size={20} />
            <span>
              Source records and our interpretation are kept separate. Every
              analysis preserves the evidence used at that time.
            </span>
          </div>
          {analysis.providers.map((p) => (
            <article className="card" key={p.source.id}>
              <div className="card-title">
                <h3>{p.source.provider_name}</h3>
                <span className="badge neutral">{p.status}</span>
              </div>
              <p>{p.source.dataset_name}</p>
              <p className="muted">{p.message}</p>
              <dl className="metadata">
                <div>
                  <dt>Licence</dt>
                  <dd>{p.source.licence}</dd>
                </div>
                <div>
                  <dt>Resolution</dt>
                  <dd>{p.source.resolution}</dd>
                </div>
                <div>
                  <dt>Retrieved</dt>
                  <dd>{new Date(p.retrieved_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Dataset version</dt>
                  <dd>{p.dataset_version}</dd>
                </div>
              </dl>
              <a
                className="text-button"
                href={p.source.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Visit original source <ArrowUpRight size={16} />
              </a>
            </article>
          ))}
          {professional && (
            <article className="card">
              <h3>Reproducibility</h3>
              <p>Model: {analysis.model_version}</p>
              <p className="mono break">
                Evidence fingerprint: {analysis.evidence_fingerprint}
              </p>
              <details>
                <summary>
                  Normalized evidence ({analysis.evidence.length} records)
                </summary>
                <pre>{JSON.stringify(analysis.evidence, null, 2)}</pre>
              </details>
            </article>
          )}
        </div>
      )}
      {tab === "Nearby" && (
        <div className="stack">
          <p className="muted">
            Reported records within {analysis.radius_km} km. Historical status
            does not establish current activity or economic viability.
          </p>
          {analysis.occurrences.length ? (
            analysis.occurrences.map((o) => (
              <article className="card occurrence" key={o.id}>
                <span className="mini-icon gold">
                  <MapPin size={19} />
                </span>
                <div>
                  <h3>{o.name}</h3>
                  <p>
                    {o.commodities.join(" · ") || "Commodity not normalized"} ·{" "}
                    {o.status}
                  </p>
                </div>
                <div>
                  <strong>{(o.distance_m / 1000).toFixed(1)} km</strong>
                  <a href={o.url} target="_blank" rel="noreferrer">
                    Source <ArrowUpRight size={13} />
                  </a>
                </div>
              </article>
            ))
          ) : (
            <Empty
              title={
                analysis.providers.find((p) => p.source.id === "usgs-mrds")
                  ?.status === "empty"
                  ? "No documented occurrences returned"
                  : "Occurrence coverage unavailable"
              }
              text="This does not prove minerals are absent. It means no occurrence records are available in this analysis."
            />
          )}
        </div>
      )}
      {tab === "Next steps" && (
        <article className="card">
          <h3>Better evidence starts with better questions.</h3>
          <ol className="steps">
            {analysis.next_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <h4>Limitations to keep in view</h4>
          <ul>
            {analysis.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <div className="notice">
            <Info size={20} />
            <span>
              Never enter abandoned mines, excavate without authorization, or
              access land without permission.
            </span>
          </div>
        </article>
      )}
      <div className="analysis-foot">
        <ShieldCheck size={15} /> Prospectivity is not discovery.{" "}
        <span>
          Analysis {analysis.model_version} ·{" "}
          {new Date(analysis.created_at).toLocaleDateString()}
        </span>
      </div>
    </section>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <FileText size={31} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
