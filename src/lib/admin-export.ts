/**
 * Admin Export Utilities — CSV & PDF export for admin tables.
 */
import jsPDF from "jspdf";

/* ── CSV Export ── */

export function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const csv = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  downloadBlob(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
}

/* ── PDF Export ── */

export function exportPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: string[][],
  options?: { orientation?: "portrait" | "landscape"; subtitle?: string }
) {
  const orientation = options?.orientation ?? "landscape";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const usableW = pageW - marginX * 2;

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, marginX, 18);

  if (options?.subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(options.subtitle, marginX, 24);
    doc.setTextColor(0);
  }

  let y = options?.subtitle ? 30 : 26;

  // Column widths — distribute evenly
  const colW = usableW / headers.length;

  // Header row
  doc.setFillColor(240, 240, 240);
  doc.rect(marginX, y, usableW, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  headers.forEach((h, i) => {
    doc.text(h, marginX + i * colW + 2, y + 5.5, { maxWidth: colW - 4 });
  });
  y += 10;

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  for (const row of rows) {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 14;
      // Repeat header
      doc.setFillColor(240, 240, 240);
      doc.rect(marginX, y, usableW, 8, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      headers.forEach((h, i) => {
        doc.text(h, marginX + i * colW + 2, y + 5.5, { maxWidth: colW - 4 });
      });
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
    }

    row.forEach((cell, i) => {
      doc.text(String(cell ?? ""), marginX + i * colW + 2, y + 4, { maxWidth: colW - 4 });
    });
    y += 7;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `REMQUIP — ${title} — Page ${p}/${totalPages} — ${new Date().toLocaleDateString()}`,
      marginX,
      doc.internal.pageSize.getHeight() - 8
    );
    doc.setTextColor(0);
  }

  doc.save(`${filename}.pdf`);
}

/* ── Helpers ── */

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
