import "server-only";
import * as XLSX from "xlsx";

const STATUS_LABELS = {
  schronisko: "W schronisku",
  zwrocony: "Zwrócony właścicielowi",
  rehabilitacja: "Rehabilitacja",
  przekazany: "Przekazany pod opiekę",
  przetrzymany: "Czasowo przetrzymany",
  adoptowany: "Adoptowany",
  inny: "Inny",
};

const COLUMNS = [
  ["Data", (a) => a.data || ""],
  ["Gmina", (a) => a.gmina_name || ""],
  ["Miejsce odłowienia", (a) => a.miejsce || ""],
  ["Zgłaszający", (a) => a.zglaszajacy || ""],
  ["Opis zwierzęcia", (a) => a.opis || ""],
  ["Nr chip", (a) => a.chip || ""],
  ["Miejsce dostarczenia", (a) => a.dostarczenie || ""],
  ["Dalszy los zwierzęcia", (a) => a.los || ""],
  ["Status", (a) => STATUS_LABELS[a.status] || a.status || ""],
  ["Zdjęcie (URL)", (a) => a.zdjecie || ""],
];

function rows(animals) {
  return animals.map((a) => COLUMNS.map(([, get]) => get(a)));
}
const header = COLUMNS.map(([label]) => label);

// CSV with a UTF-8 BOM so Excel opens Polish characters correctly.
export function buildCsv(animals) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows(animals)].map((r) => r.map(esc).join(";"));
  return "\uFEFF" + lines.join("\r\n");
}

// XLSX workbook as a Node Buffer.
export function buildXlsx(animals) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows(animals)]);
  ws["!cols"] = [12, 16, 24, 14, 40, 18, 24, 40, 20, 30].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rejestr");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function exportFilename(ext) {
  const d = new Date().toISOString().slice(0, 10);
  return `rejestr-zwierzat-${d}.${ext}`;
}
