import { jsPDF } from "jspdf";
import type { Analysis } from "../types";

export async function exportReport(a: Analysis, _html: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({
    title: "GeoMineral Exploration Report",
    author: "GeoMineral",
  });
  let y = 28;
  const write = (text: string, size = 11, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(24, 53, 40);
    const lines: string[] = pdf.splitTextToSize(
      text.replace(/[–—]/g, "-").replace(/↗/g, ""),
      170,
    );
    for (const line of lines) {
      if (y > 270) {
        pdf.addPage();
        y = 25;
      }
      pdf.text(line, 20, y);
      y += size * 0.48;
    }
    y += 4;
  };
  write("GEOMINERAL", 12, true);
  write("Exploration Report", 25, true);
  write(a.location.name, 16, true);
  write(
    `${a.location.lat.toFixed(5)}, ${a.location.lng.toFixed(5)} | ${a.created_at}`,
    9,
  );
  write(a.summary);
  write("Mineral screening", 15, true);
  for (const m of a.assessments) {
    write(`${m.commodity} | ${m.prospectivity}`, 12, true);
    write(`Evidence quality: ${m.evidence_quality}`, 9);
    write(m.explanation);
  }
  write("Sources", 15, true);
  for (const p of a.providers) {
    write(`${p.source.dataset_name} | ${p.status}`, 11, true);
    write(p.source.source_url, 9);
  }
  write("Next steps", 15, true);
  a.next_steps.forEach((n) => write(n));
  write("Limitations", 15, true);
  a.limitations.forEach((n) => write(n));
  write(
    "Regional screening only. No reserves, grade, economic value or mineral rights are established.",
    9,
  );
  write(`Model: ${a.model_version}`, 9);
  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    pdf.setPage(page);
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(`GeoMineral | ${page} / ${total}`, 20, 286);
  }
  pdf.save("GeoMineral-Exploration-Report.pdf");
}
