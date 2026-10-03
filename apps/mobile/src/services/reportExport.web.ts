import { jsPDF } from "jspdf";
import { distance, ratingColor, siteColor } from "../theme";
import type { Analysis } from "../types";
import { bestSignal, formatDate, plot } from "./reportHtml";

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const clean = (s: string) =>
  s.replace(/[–—]/g, "-").replace(/[↗·]/g, "|").replace(/[^\x20-\x7E]/g, "");
const label = (r?: string) =>
  r === "Insufficient evidence" ? "Not enough data" : (r ?? "");

export async function exportReport(a: Analysis, _html: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({
    title: `GeoMineral Report - ${clean(a.location.name)}`,
    author: "GeoMineral",
  });
  const L = 18,
    W = 174,
    ink: [number, number, number] = [27, 49, 39],
    muted: [number, number, number] = [122, 136, 127];
  let y = 0;
  const ensure = (h: number) => {
    if (y + h > 278) {
      pdf.addPage();
      y = 20;
    }
  };
  const text = (
    s: string,
    x: number,
    size: number,
    opts: { bold?: boolean; color?: [number, number, number]; width?: number } = {},
  ) => {
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(opts.color ?? ink));
    const lines: string[] = pdf.splitTextToSize(clean(s), opts.width ?? W);
    pdf.text(lines, x, y);
    return lines.length * size * 0.42;
  };
  const heading = (s: string) => {
    ensure(16);
    y += 8;
    text(s, L, 13, { bold: true });
    y += 2.5;
    pdf.setDrawColor(227, 232, 226);
    pdf.line(L, y, L + W, y);
    y += 6;
  };

  // Cover band
  pdf.setFillColor(11, 35, 28);
  pdf.rect(0, 0, 210, 52, "F");
  y = 16;
  text("Geo", L, 12, { bold: true, color: [255, 255, 255] });
  pdf.setTextColor(217, 176, 79);
  pdf.text("Mineral", L + pdf.getTextWidth("Geo"), y);
  y = 34;
  const name = a.location.name.length > 46 ? `${a.location.name.slice(0, 45)}...` : a.location.name;
  text(name, L, 21, { bold: true, color: [255, 255, 255] });
  y = 43;
  text(
    `${a.location.lat.toFixed(5)}, ${a.location.lng.toFixed(5)} | ${a.radius_km} km radius | ${formatDate(a.created_at)}`,
    L,
    9,
    { color: [185, 204, 194] },
  );

  // Site plot
  const P = 70,
    px = L,
    py = 62;
  pdf.setFillColor(11, 35, 28);
  pdf.roundedRect(px, py, P, P, 4, 4, "F");
  pdf.setDrawColor(242, 210, 122);
  pdf.setLineWidth(0.35);
  pdf.circle(px + P / 2, py + P / 2, P / 2.2, "S");
  pdf.setLineDashPattern([0.8, 1.2], 0);
  pdf.circle(px + P / 2, py + P / 2, P / 4.4, "S");
  pdf.setLineDashPattern([], 0);
  for (const o of a.occurrences) {
    const p = plot(a, o);
    pdf.setFillColor(...rgb(siteColor(o.status)));
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.3);
    pdf.circle(px + p.x * P, py + p.y * P, 1.1, "FD");
  }
  pdf.setFillColor(255, 255, 255);
  pdf.circle(px + P / 2, py + P / 2, 1.6, "F");
  pdf.setFillColor(11, 93, 45);
  pdf.circle(px + P / 2, py + P / 2, 0.95, "F");
  pdf.setFontSize(7);
  pdf.setTextColor(242, 210, 122);
  pdf.text("N", px + P / 2, py + 5, { align: "center" });
  pdf.text(`${a.radius_km} km`, px + P / 2 + P / 2.2 - 1, py + P / 2 - 1.5, {
    align: "right",
  });

  // Headline
  const top = bestSignal(a);
  const rating = top?.prospectivity ?? a.rating;
  const hx = px + P + 10,
    hw = W - P - 10;
  y = py + 6;
  const [r, g, b] = rgb(ratingColor(rating));
  pdf.setFillColor(r, g, b);
  pdf.roundedRect(hx, y - 4, pdf.getTextWidth(label(rating)) * 0.95 + 8, 6, 3, 3, "F");
  text(label(rating), hx + 3, 8, { bold: true, color: [255, 255, 255] });
  y += 11;
  y += text(top ? top.commodity : "No clear signal", hx, 19, { bold: true, width: hw });
  y += 1;
  y += text(top?.explanation ?? a.summary, hx, 9.5, { width: hw, color: [70, 85, 77] });
  y += 6;
  const producers = a.occurrences.filter((o) =>
    o.status.toLowerCase().includes("producer"),
  ).length;
  const rated = a.assessments.filter(
    (m) => m.prospectivity !== "Insufficient evidence",
  );
  [
    [a.occurrences.length, "Sites"],
    [producers, "Producers"],
    [rated.length, "Minerals"],
  ].forEach(([v, l], i) => {
    const x = hx + i * 26;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(...ink);
    pdf.text(String(v), x, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text(String(l), x, y + 4.5);
  });
  y = py + P + 4;

  heading("Minerals");
  if (!rated.length) y += text("No mineral signal from connected sources.", L, 10, { color: muted });
  for (const m of rated.slice(0, 12)) {
    pdf.setFontSize(9.5);
    const lines = pdf.splitTextToSize(clean(m.explanation), 112).length;
    ensure(lines * 4 + 5);
    text(m.commodity, L, 10, { bold: true, width: 32 });
    pdf.setFillColor(...rgb(ratingColor(m.prospectivity)));
    pdf.circle(L + 35, y - 1.2, 1.2, "F");
    text(label(m.prospectivity), L + 38, 9.5, { width: 22 });
    y += Math.max(text(m.explanation, L + 62, 9.5, { width: 112, color: [70, 85, 77] }), 4) + 3.5;
  }

  heading("Recorded sites");
  if (!a.occurrences.length)
    y += text(`No recorded sites within ${a.radius_km} km.`, L, 10, { color: muted });
  const sites = a.occurrences.slice(0, 40);
  for (const o of sites) {
    ensure(7);
    pdf.setFillColor(...rgb(siteColor(o.status)));
    pdf.circle(L + 1.2, y - 1.2, 1.2, "F");
    text(o.name, L + 4, 9.5, { bold: true, width: 60 });
    text(o.status, L + 68, 9, { width: 30, color: muted });
    text(o.commodities.join(", "), L + 100, 9, { width: 56, color: muted });
    pdf.text(clean(distance(o.distance_m)), L + W, y, { align: "right" });
    y += 6;
  }
  if (a.occurrences.length > sites.length)
    y += text(`Closest ${sites.length} of ${a.occurrences.length} shown.`, L, 8.5, { color: muted });

  heading("Geology");
  if (!a.geology_units?.length) y += text("No mapped geology returned.", L, 10, { color: muted });
  for (const u of a.geology_units ?? []) {
    ensure(14);
    pdf.setFillColor(...rgb(/^#[0-9a-f]{6}$/i.test(u.color) ? u.color : "#DDE3DC"));
    pdf.rect(L, y - 3.5, 1.6, 9, "F");
    text(`${u.name}${u.age ? `  |  ${u.age}` : ""}`, L + 5, 10, { bold: true, width: W - 5 });
    y += 4.6;
    y += text(u.lith || "-", L + 5, 9, { color: [70, 85, 77], width: W - 5 }) + 3.5;
  }

  heading("Next steps");
  a.next_steps.forEach((n, i) => {
    ensure(8);
    y += text(`${i + 1}.  ${n}`, L, 9.5, { width: W }) + 2;
  });

  heading("Sources");
  for (const p of a.providers) {
    ensure(10);
    y += text(`${p.source.dataset_name} | ${p.source.provider_name} | ${p.status}`, L, 9.5, { bold: true });
    y += text(`${p.source.licence} | ${p.source.source_url}`, L, 8.5, { color: muted }) + 2;
  }
  y += 4;
  ensure(16);
  text(
    `${a.limitations.join(" ")} Model ${a.model_version} | ${a.evidence_fingerprint.slice(0, 12)}`,
    L,
    7.5,
    { color: [138, 151, 143] },
  );

  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text(`GeoMineral  |  ${clean(a.location.name)}`, L, 290);
    pdf.text(`${page} / ${total}`, L + W, 290, { align: "right" });
  }
  pdf.save("GeoMineral-Exploration-Report.pdf");
}
