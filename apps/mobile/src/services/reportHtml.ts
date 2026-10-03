import { distance, ratingColor, siteColor } from "../theme";
import type { Analysis, Occurrence } from "../types";

export const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const label = (rating?: string) =>
  rating === "Insufficient evidence" ? "Not enough data" : (rating ?? "");

export const bestSignal = (a: Analysis) =>
  a.assessments.find((m) => m.prospectivity !== "Insufficient evidence");

/** Site position in a unit square around the centre, north up. */
export function plot(a: Analysis, o: Pick<Occurrence, "lat" | "lng">) {
  const km = a.radius_km;
  const dx =
    (o.lng - a.location.lng) *
    111.32 *
    Math.cos((a.location.lat * Math.PI) / 180);
  const dy = (o.lat - a.location.lat) * 110.57;
  return { x: 0.5 + dx / (km * 2.2), y: 0.5 - dy / (km * 2.2) };
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

function sitePlot(a: Analysis) {
  const size = 300;
  const r = (size / 2.2) * 1;
  const dots = a.occurrences
    .map((o) => {
      const p = plot(a, o);
      return `<circle cx="${(p.x * size).toFixed(1)}" cy="${(p.y * size).toFixed(1)}" r="4.5" fill="${siteColor(o.status)}" stroke="#fff" stroke-width="1.5"/>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="14" fill="#0B231C"/>
  <circle cx="150" cy="150" r="${r}" fill="#F2D27A14" stroke="#F2D27A" stroke-width="1.2"/>
  <circle cx="150" cy="150" r="${r / 2}" fill="none" stroke="#F2D27A55" stroke-dasharray="3 4"/>
  ${dots}
  <circle cx="150" cy="150" r="6" fill="#fff"/><circle cx="150" cy="150" r="3.5" fill="#0B5D2D"/>
  <text x="150" y="20" fill="#F2D27A" font-size="11" text-anchor="middle" font-family="Helvetica">N</text>
  <text x="${150 + r / 2}" y="146" fill="#F2D27Aaa" font-size="9" text-anchor="middle" font-family="Helvetica">${a.radius_km / 2} km</text>
  <text x="${150 + r - 4}" y="146" fill="#F2D27Aaa" font-size="9" text-anchor="end" font-family="Helvetica">${a.radius_km} km</text>
</svg>`;
}

const legend = [
  ["Producer", "Producer"],
  ["Past producer", "Past Producer"],
  ["Prospect", "Prospect"],
  ["Occurrence", "Occurrence"],
]
  .map(
    ([l, s]) =>
      `<span class="lg"><i style="background:${siteColor(s)}"></i>${l}</span>`,
  )
  .join("");

export function reportHtml(a: Analysis, coords: string) {
  const top = bestSignal(a);
  const rating = top?.prospectivity ?? a.rating;
  const producers = a.occurrences.filter((o) =>
    o.status.toLowerCase().includes("producer"),
  ).length;
  const minerals = a.assessments
    .filter((m) => m.prospectivity !== "Insufficient evidence")
    .slice(0, 12);
  const sites = a.occurrences.slice(0, 40);
  return `<!doctype html><html><head><meta charset="utf-8"/><title>GeoMineral Report · ${esc(a.location.name)}</title><style>
  @page{size:A4;margin:0}
  *{box-sizing:border-box}
  body{margin:0;font:12px/1.55 -apple-system,Helvetica,Arial,sans-serif;color:#1B3127;background:#fff}
  .cover{background:#0B231C;color:#fff;padding:38px 42px 30px}
  .brand{font-weight:700;font-size:15px;letter-spacing:-.3px}.brand b{color:#D9B04F}
  .cover h1{font-size:30px;line-height:1.15;margin:26px 0 6px;letter-spacing:-.8px}
  .cover p{margin:0;color:#B9CCC2;font-size:11px}
  .wrap{padding:28px 42px 36px}
  .hero{display:flex;gap:26px;align-items:center;margin-bottom:24px}
  .pill{display:inline-block;padding:4px 11px;border-radius:20px;font-weight:700;font-size:11px}
  .big{font-size:26px;font-weight:700;letter-spacing:-.6px;margin:8px 0 6px}
  .stats{display:flex;gap:26px;margin-top:14px}.stats div{font-size:10px;color:#6E7D74}.stats b{display:block;font-size:20px;color:#1B3127}
  h2{font-size:15px;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid #E3E8E2;letter-spacing:-.2px;page-break-after:avoid}
  table{width:100%;border-collapse:collapse;font-size:11px}
  td,th{padding:7px 6px;border-bottom:1px solid #EEF1ED;text-align:left;vertical-align:top}
  th{font-size:9.5px;text-transform:uppercase;letter-spacing:.6px;color:#7A887F;font-weight:600}
  tr{page-break-inside:avoid}
  .dot{display:inline-block;width:8px;height:8px;border-radius:4px;margin-right:6px}
  .lg{margin-right:14px;font-size:10px;color:#5F6F66}.lg i{display:inline-block;width:8px;height:8px;border-radius:4px;margin-right:5px}
  .unit{display:flex;gap:10px;margin:0 0 10px;page-break-inside:avoid}.unit i{width:5px;border-radius:3px;flex:none}
  .muted{color:#7A887F;font-size:10.5px}
  ol{padding-left:18px;margin:0}li{margin:0 0 5px}
  .foot{margin-top:28px;padding-top:12px;border-top:1px solid #E3E8E2;font-size:9.5px;color:#8A978F}
  a{color:#245B40;text-decoration:none}
</style></head><body>
<div class="cover">
  <div class="brand">Geo<b>Mineral</b></div>
  <h1>${esc(a.location.name)}</h1>
  <p>${esc(coords)} · ${a.radius_km} km radius · ${esc(formatDate(a.created_at))}</p>
</div>
<div class="wrap">
  <div class="hero">
    ${sitePlot(a)}
    <div>
      <span class="pill" style="background:${ratingColor(rating)}22;color:${ratingColor(rating)}">${esc(label(rating))}</span>
      <div class="big">${esc(top ? top.commodity : "No clear signal")}</div>
      <div>${esc(top?.explanation ?? a.summary)}</div>
      <div class="stats"><div><b>${a.occurrences.length}</b>Sites</div><div><b>${producers}</b>Producers</div><div><b>${minerals.length}</b>Minerals</div></div>
      <p style="margin-top:14px">${legend}</p>
    </div>
  </div>
  <h2>Minerals</h2>
  ${
    minerals.length
      ? `<table><tr><th>Mineral</th><th>Rating</th><th>Why</th></tr>${minerals
          .map(
            (m) =>
              `<tr><td><b>${esc(m.commodity)}</b></td><td><span class="dot" style="background:${ratingColor(m.prospectivity)}"></span>${esc(label(m.prospectivity))}</td><td>${esc(m.explanation)}</td></tr>`,
          )
          .join("")}</table>`
      : `<p class="muted">No mineral signal from connected sources.</p>`
  }
  <h2>Recorded sites</h2>
  ${
    sites.length
      ? `<table><tr><th>Site</th><th>Status</th><th>Minerals</th><th>Distance</th></tr>${sites
          .map(
            (o) =>
              `<tr><td><a href="${esc(o.url)}">${esc(o.name)}</a></td><td><span class="dot" style="background:${siteColor(o.status)}"></span>${esc(o.status)}</td><td>${esc(o.commodities.join(", "))}</td><td>${esc(distance(o.distance_m))}</td></tr>`,
          )
          .join("")}</table>${
          a.occurrences.length > sites.length
            ? `<p class="muted">Closest ${sites.length} of ${a.occurrences.length} shown.</p>`
            : ""
        }`
      : `<p class="muted">No recorded sites within ${a.radius_km} km.</p>`
  }
  <h2>Geology</h2>
  ${
    a.geology_units?.length
      ? a.geology_units
          .map(
            (u) =>
              `<div class="unit"><i style="background:${esc(u.color || "#DDE3DC")}"></i><div><b>${esc(u.name)}</b>${u.age ? ` <span class="muted">· ${esc(u.age)}</span>` : ""}<br/>${esc(u.lith)}${u.reference ? `<br/><span class="muted">${esc(u.reference)}</span>` : ""}</div></div>`,
          )
          .join("")
      : `<p class="muted">No mapped geology returned.</p>`
  }
  <h2>Next steps</h2>
  <ol>${a.next_steps.map((n) => `<li>${esc(n)}</li>`).join("")}</ol>
  <h2>Sources</h2>
  ${a.providers
    .map(
      (p) =>
        `<p style="margin:0 0 6px"><b>${esc(p.source.dataset_name)}</b> · ${esc(p.source.provider_name)} · ${esc(p.status)}<br/><span class="muted">${esc(p.source.licence)} · <a href="${esc(p.source.source_url)}">${esc(p.source.source_url)}</a></span></p>`,
    )
    .join("")}
  <div class="foot">${a.limitations.map(esc).join(" ")} Model ${esc(a.model_version)} · ${esc(a.evidence_fingerprint.slice(0, 12))}</div>
</div>
</body></html>`;
}
