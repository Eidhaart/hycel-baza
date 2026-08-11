"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  PawPrint, Plus, Search, LayoutGrid, List as ListIcon, Table2, Sun, Moon,
  LogOut, Settings, X, Upload, Trash2, Pencil, ImageOff, MapPin, Calendar,
  Cpu, ClipboardList, ShieldCheck, Building2, ArrowRight, Download,
  ShieldAlert, Check, Printer,
} from "lucide-react";
import {
  logout, createAnimal, updateAnimal, deleteAnimal,
  wipeAllAnimals, saveGminas, acknowledgeExport,
} from "../app/actions";

/* ----------------------------- constants ----------------------------- */

export const STATUSES = [
  { id: "schronisko",    label: "W schronisku",           c: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { id: "zwrocony",      label: "Zwrócony właścicielowi",  c: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  { id: "rehabilitacja", label: "Rehabilitacja",           c: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200" },
  { id: "przekazany",    label: "Przekazany pod opiekę",   c: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200" },
  { id: "przetrzymany",  label: "Czasowo przetrzymany",    c: "bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200" },
  { id: "adoptowany",    label: "Adoptowany",              c: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  { id: "inny",          label: "Inny",                    c: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200" },
];
const statusMeta = (id) => STATUSES.find((s) => s.id === id) || STATUSES[6];
const REPORTERS = ["Straż miejska", "UG", "Policja", "Inny"];
const NO_DATE = "__brak__";

/* ----------------------------- helpers ------------------------------- */

const cx = (...a) => a.filter(Boolean).join(" ");
const uid = () =>
  crypto?.randomUUID?.() ||
  "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);

const PL_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

function plLongDate(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getDate()} ${PL_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function compressImage(file, maxDim = 1200, q = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = (height * maxDim) / width; width = maxDim; }
        else if (height > maxDim) { width = (width * maxDim) / height; height = maxDim; }
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        c.getContext("2d").drawImage(img, 0, 0, width, height);
        c.toBlob(
          (blob) => (blob ? resolve({ blob, url: URL.createObjectURL(blob) }) : reject(new Error("blob"))),
          "image/jpeg", q
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const INPUT = "w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500 transition placeholder-stone-400 dark:placeholder-stone-500";
const CARD = "rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm dark:shadow-none";
const HOVER = "hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-md dark:hover:shadow-none";
const PANEL = "rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900";
const SUBTLE_HOVER = "hover:bg-stone-100 dark:hover:bg-stone-800";

/* ================================= App ================================ */

export default function AppShell({ session, initialAnimals, gminas, exportPending = false, lastExportSentAt = null }) {
  const router = useRouter();
  const isAdmin = session.role === "admin";

  const [animals, setAnimals] = useState(initialAnimals);
  useEffect(() => { setAnimals(initialAnimals); }, [initialAnimals]);

  const [dark, setDark] = useState(false);
  const [view, setView] = useState("table");
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const [query, setQuery] = useState("");
  const [fGmina, setFGmina] = useState("");

  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [preview, setPreview] = useState(null);
  const [printMenu, setPrintMenu] = useState(false);

  /* ---- years, exactly like the sheet tabs in Excel ---- */
  // Only consider the animals actually in view (an admin filtering to one
  // gmina should see just that gmina's years — empty years disappear).
  const scoped = useMemo(
    () => (isAdmin && fGmina ? animals.filter((a) => a.gmina_id === fGmina) : animals),
    [animals, isAdmin, fGmina]
  );
  const years = useMemo(() => {
    const s = new Set();
    scoped.forEach((a) => { if (a.data) s.add(a.data.slice(0, 4)); });
    if (isAdmin) s.add(String(new Date().getFullYear())); // admin can always add to the current year
    const arr = [...s].sort((a, b) => b.localeCompare(a));
    return arr.length ? arr : [String(new Date().getFullYear())];
  }, [scoped, isAdmin]);
  const hasUndated = useMemo(() => scoped.some((a) => !a.data), [scoped]);

  const [year, setYear] = useState(null);
  useEffect(() => {
    if (year === null || (year !== NO_DATE && !years.includes(year))) {
      const cur = String(new Date().getFullYear());
      setYear(years.includes(cur) ? cur : years[0]);
    }
  }, [years, year]);

  const toggleTheme = () => {
    const el = document.documentElement;
    const next = !el.classList.contains("dark");
    el.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };
  const changeView = (v) => setView(v);
  const refresh = () => router.refresh();
  const doLogout = async () => { await logout(); refresh(); };

  /* ---- filtering: year first, then gmina/search ---- */
  const visible = useMemo(() => {
    let list = animals;
    if (year === NO_DATE) list = list.filter((a) => !a.data);
    else if (year) list = list.filter((a) => a.data && a.data.startsWith(year));

    if (isAdmin && fGmina) list = list.filter((a) => a.gmina_id === fGmina);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((a) =>
        [a.opis, a.miejsce, a.dostarczenie, a.los, a.chip, a.gmina_name]
          .filter(Boolean).join(" ").toLowerCase().includes(q));
    }
    // Ascending within the year, so "lp 1" is the first animal of the year,
    // matching how the spreadsheet is numbered.
    return [...list].sort((x, y2) =>
      (x.data || "9999").localeCompare(y2.data || "9999") ||
      String(x.created_at || "").localeCompare(String(y2.created_at || ""))
    );
  }, [animals, year, isAdmin, fGmina, query]);

  const printHref = (foto) => {
    const y = year && year !== NO_DATE ? year : new Date().getFullYear();
    const g = isAdmin && fGmina ? `&gmina=${fGmina}` : "";
    return `/druk?rok=${y}&foto=${foto}${g}`;
  };

  const gminaLabel = isAdmin
    ? (fGmina ? gminas.find((g) => g.id === fGmina)?.name : null)
    : session.gminaName;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur">
        <div className="mx-auto max-w-[1700px] px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-teal-600 text-white shrink-0">
              <PawPrint size={18} />
            </span>
            <div className="min-w-0">
              <h1 className="font-semibold leading-tight tracking-tight truncate">Rejestr zwierząt</h1>
              <div className="text-xs flex items-center gap-1 truncate text-stone-500 dark:text-stone-400">
                {isAdmin
                  ? <><ShieldCheck size={12} /> Administrator</>
                  : <><Building2 size={12} /> {session.gminaName}</>}
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <IconBtn onClick={toggleTheme} label="Motyw">{dark ? <Sun size={18} /> : <Moon size={18} />}</IconBtn>
            {isAdmin && <IconBtn onClick={() => setModal("settings")} label="Ustawienia" badge={exportPending}><Settings size={18} /></IconBtn>}
            <IconBtn onClick={doLogout} label="Wyloguj"><LogOut size={18} /></IconBtn>
          </div>
        </div>
      </header>

      {/* Search + gmina + view switch */}
      <div className="mx-auto max-w-[1700px] px-4 pt-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj…"
              className={cx(INPUT, "pl-10")}
            />
          </div>
          {isAdmin && (
            <select value={fGmina} onChange={(e) => setFGmina(e.target.value)}
              className={cx(INPUT, "w-auto appearance-none")}>
              <option value="">Wszystkie gminy</option>
              {gminas.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <div className="relative shrink-0">
            <button onClick={() => setPrintMenu((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 px-3 py-2.5 text-sm font-medium transition hover:bg-stone-100 dark:hover:bg-stone-800"
              title="Wersja do druku / PDF">
              <Printer size={17} /> <span className="hidden sm:inline">Drukuj</span>
            </button>
            {printMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPrintMenu(false)} />
                <div className="absolute right-0 mt-2 z-50 w-56 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-lg overflow-hidden">
                  <a href={printHref(1)} target="_blank" rel="noopener noreferrer"
                    onClick={() => setPrintMenu(false)}
                    className="block px-4 py-3 text-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition">
                    Drukuj <strong>ze zdjęciami</strong>
                    <span className="block text-xs text-stone-500 dark:text-stone-400">A4 poziomo</span>
                  </a>
                  <a href={printHref(0)} target="_blank" rel="noopener noreferrer"
                    onClick={() => setPrintMenu(false)}
                    className="block px-4 py-3 text-sm border-t border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition">
                    Drukuj <strong>bez zdjęć</strong>
                    <span className="block text-xs text-stone-500 dark:text-stone-400">A4 pionowo</span>
                  </a>
                </div>
              </>
            )}
          </div>
          <div className="flex rounded-xl p-1 bg-stone-200 dark:bg-stone-800 shrink-0">
            <button onClick={() => changeView("table")} aria-label="Tabela"
              className={cx("p-2 rounded-lg transition", view === "table" ? "bg-white dark:bg-stone-700 shadow-sm" : "text-stone-500 dark:text-stone-400")}><Table2 size={18} /></button>
            <button onClick={() => changeView("grid")} aria-label="Kafelki"
              className={cx("p-2 rounded-lg transition", view === "grid" ? "bg-white dark:bg-stone-700 shadow-sm" : "text-stone-500 dark:text-stone-400")}><LayoutGrid size={18} /></button>
            <button onClick={() => changeView("list")} aria-label="Lista"
              className={cx("p-2 rounded-lg transition", view === "list" ? "bg-white dark:bg-stone-700 shadow-sm" : "text-stone-500 dark:text-stone-400")}><ListIcon size={18} /></button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-[1700px] px-4 pt-4 pb-28">
        {visible.length === 0 ? (
          <Empty isAdmin={isAdmin} onAdd={() => { setEditing(null); setModal("add"); }} />
        ) : view === "table" ? (
          <SheetTable rows={visible} year={year} gminaLabel={gminaLabel}
            showGmina={isAdmin && !fGmina} onRow={(a) => setDetail(a)} onImage={(src) => setPreview(src)} />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((a) => <GridCard key={a.id} a={a} onClick={() => setDetail(a)} showGmina={isAdmin} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((a) => <Row key={a.id} a={a} onClick={() => setDetail(a)} showGmina={isAdmin} />)}
          </div>
        )}
      </main>

      {/* Year tabs along the bottom, like the sheet tabs in Excel */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur">
        <div className="mx-auto max-w-[1700px] px-3 py-2 flex items-center gap-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            {years.map((y) => (
              <button key={y} onClick={() => setYear(y)}
                className={cx("shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition",
                  year === y
                    ? "bg-teal-600 text-white"
                    : cx("text-stone-600 dark:text-stone-300", SUBTLE_HOVER))}>
                {y}
              </button>
            ))}
            {hasUndated && (
              <button onClick={() => setYear(NO_DATE)}
                className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
                  year === NO_DATE
                    ? "bg-teal-600 text-white"
                    : cx("text-stone-600 dark:text-stone-300", SUBTLE_HOVER))}>
                Bez daty
              </button>
            )}
          </div>
          {isAdmin && (
            <button onClick={() => { setEditing(null); setModal("add"); }} aria-label="Dodaj zwierzę"
              className="ml-auto shrink-0 h-11 w-11 rounded-full bg-teal-600 hover:bg-teal-700 text-white grid place-items-center shadow-lg shadow-teal-600/30 transition active:scale-95">
              <Plus size={24} />
            </button>
          )}
        </div>
      </div>

      {detail && (
        <Detail a={detail} isAdmin={isAdmin}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setModal("edit"); }}
          onDelete={async () => {
            if (!confirm("Usunąć ten wpis? Tej operacji nie można cofnąć.")) return;
            await deleteAnimal(detail.id); setDetail(null); refresh();
          }} />
      )}

      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}

      {(modal === "add" || modal === "edit") && (
        <EntryForm gminas={gminas} initial={editing}
          onCancel={() => { setModal(null); setEditing(null); }}
          onSaved={() => { setModal(null); setEditing(null); refresh(); }} />
      )}

      {modal === "settings" && (
        <SettingsPanel gminas={gminas}
          exportPending={exportPending}
          lastExportSentAt={lastExportSentAt}
          selectedGmina={fGmina}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refresh(); }}
          onAcknowledged={() => { setModal(null); refresh(); }}
          onWipe={async () => {
            if (!confirm("Usunąć WSZYSTKIE wpisy? Nie można tego cofnąć.")) return;
            await wipeAllAnimals(); setModal(null); refresh();
          }} />
      )}
    </div>
  );
}

/* ========================= the spreadsheet view ======================== */

function Lightbox({ src, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={onClose}>
      <img src={src} alt="" onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] max-w-[92vw] object-contain rounded-lg shadow-2xl" />
      <button onClick={onClose} aria-label="Zamknij"
        className="absolute top-4 right-4 h-10 w-10 grid place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 transition">
        <X size={20} />
      </button>
    </div>
  );
}

const TH = "border border-stone-300 dark:border-stone-600 bg-[#cfe3d4] dark:bg-teal-950 px-3 py-3 text-sm font-semibold text-center align-middle text-stone-800 dark:text-teal-100";
const TD = "border border-stone-300 dark:border-stone-700 px-3 py-2.5 text-sm align-middle";

function SheetTable({ rows, year, gminaLabel, showGmina, onRow, onImage }) {
  const title =
    "Zwierzęta odłowione z terenu " +
    (gminaLabel ? `gminy ${gminaLabel}` : "wszystkich gmin") +
    (year && year !== NO_DATE ? ` w ${year} roku` : "");

  return (
    <div className="overflow-auto rounded-xl border border-stone-300 dark:border-stone-700 max-h-[calc(100vh-240px)]">
      <table className="w-full min-w-[900px] border-collapse bg-white dark:bg-stone-900">
        <thead className="sticky top-0 z-10">
          <tr>
            <th colSpan={showGmina ? 12 : 11}
              className="border border-stone-300 dark:border-stone-600 bg-[#cfe3d4] dark:bg-teal-950 px-3 py-2.5 text-base font-semibold text-stone-800 dark:text-teal-100">
              {title}
            </th>
          </tr>
          <tr>
            <th className={cx(TH, "w-10")}>lp</th>
            <th className={cx(TH, "w-24")}>data</th>
            <th className={cx(TH, "w-40")}>miejsce odłowienia</th>
            {showGmina && <th className={cx(TH, "w-28")}>gmina</th>}
            <th className={cx(TH, "w-24")}>zgłaszający</th>
            <th className={cx(TH, "w-56")}>opis zwierzęcia</th>
            <th className={cx(TH, "whitespace-nowrap")}>chip</th>
            <th className={cx(TH, "w-36")}>miejsce dostarczenia</th>
            <th className={cx(TH, "w-44")}>dalszy los zwierzęcia</th>
            <th className={cx(TH, "w-32")}>status</th>
            <th className={cx(TH, "w-52")}>zdjęcie</th>
            <th className={cx(TH, "w-64")}>notatka</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={a.id} onClick={() => onRow(a)}
              className="cursor-pointer even:bg-stone-50 dark:even:bg-stone-800/40 hover:bg-teal-50 dark:hover:bg-stone-800 transition">
              <td className={cx(TD, "text-center text-stone-500 dark:text-stone-400")}>{i + 1}</td>
              <td className={cx(TD, "text-center whitespace-nowrap")}>{fmtDate(a.data)}</td>
              <td className={cx(TD, "text-center")}>{a.miejsce || ""}</td>
              {showGmina && <td className={cx(TD, "text-center")}>{a.gmina_name || ""}</td>}
              <td className={cx(TD, "text-center")}>{a.zglaszajacy || ""}</td>
              <td className={cx(TD, "text-center")}>{a.opis || ""}</td>
              <td className={cx(TD, "text-center whitespace-nowrap")}>{a.chip || "-"}</td>
              <td className={cx(TD, "text-center")}>{a.dostarczenie || ""}</td>
              <td className={cx(TD, "text-center")}>{a.los || ""}</td>
              <td className={cx(TD, "text-center whitespace-nowrap")}><StatusPill id={a.status} /></td>
              <td className={cx(TD, "text-center p-1")}>
                {a.zdjecie
                  ? <img src={a.zdjecie} alt=""
                      onClick={(e) => { e.stopPropagation(); onImage(a.zdjecie); }}
                      className="h-32 w-48 object-contain mx-auto rounded bg-stone-50 dark:bg-stone-800 cursor-zoom-in" />
                  : <span className="text-stone-300 dark:text-stone-600">—</span>}
              </td>
              <td className={cx(TD, "text-left align-top whitespace-pre-wrap break-words text-sm")}>
                {a.notatka || <span className="text-stone-300 dark:text-stone-600">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================ presentational ========================== */

function IconBtn({ onClick, label, children, badge }) {
  return (
    <button onClick={onClick} aria-label={label}
      className={cx("relative h-9 w-9 grid place-items-center rounded-xl transition text-stone-500 dark:text-stone-400", SUBTLE_HOVER)}>
      {children}
      {badge && (
        <span className="absolute top-1 left-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-stone-900" />
      )}
    </button>
  );
}

function StatusPill({ id, size = "sm" }) {
  const m = statusMeta(id);
  return (
    <span className={cx("inline-flex items-center rounded-full font-medium",
      size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm", m.c)}>
      {m.label}
    </span>
  );
}

function Photo({ src, className, iconSize = 28 }) {
  if (src) return <img src={src} alt="" className={cx("object-cover", className)} />;
  return (
    <div className={cx("grid place-items-center bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600", className)}>
      <ImageOff size={iconSize} />
    </div>
  );
}

function GridCard({ a, onClick, showGmina }) {
  return (
    <button onClick={onClick} className={cx("group text-left overflow-hidden transition", CARD, HOVER)}>
      <div className="relative">
        <Photo src={a.zdjecie} className="h-40 w-full" />
        <div className="absolute top-2 left-2"><StatusPill id={a.status} /></div>
      </div>
      <div className="p-3.5">
        <p className="font-medium leading-snug line-clamp-2">{a.opis}</p>
        <div className="mt-2 space-y-1 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5"><Calendar size={12} className="text-stone-400 dark:text-stone-500" /> {fmtDate(a.data)}</div>
          <div className="flex items-center gap-1.5"><MapPin size={12} className="text-stone-400 dark:text-stone-500" /> <span className="truncate">{a.miejsce || "—"}</span></div>
          {showGmina && <div className="flex items-center gap-1.5"><Building2 size={12} className="text-stone-400 dark:text-stone-500" /> {a.gmina_name}</div>}
        </div>
      </div>
    </button>
  );
}

function Row({ a, onClick, showGmina }) {
  return (
    <button onClick={onClick} className={cx("w-full text-left p-2.5 flex items-center gap-3 transition", CARD, HOVER)}>
      <Photo src={a.zdjecie} className="h-14 w-14 rounded-xl shrink-0" iconSize={20} />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug truncate">{a.opis}</p>
        <div className="text-xs mt-0.5 flex items-center gap-2 truncate text-stone-500 dark:text-stone-400">
          <span>{fmtDate(a.data)}</span><span className="text-stone-300 dark:text-stone-600">·</span>
          <span className="truncate">{a.miejsce || "—"}</span>
          {showGmina && <><span className="text-stone-300 dark:text-stone-600">·</span><span>{a.gmina_name}</span></>}
        </div>
      </div>
      <StatusPill id={a.status} />
    </button>
  );
}

function Empty({ isAdmin, onAdd }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center">
      <span className="mx-auto grid place-items-center h-12 w-12 rounded-2xl mb-3 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
        <ClipboardList size={22} />
      </span>
      <p className="font-medium">Brak wpisów</p>
      <p className="text-sm mt-1 text-stone-500 dark:text-stone-400">
        {isAdmin ? "Dodaj pierwsze zwierzę w tym roku." : "W tym roku nie ma jeszcze żadnych zwierząt."}
      </p>
      {isAdmin && (
        <button onClick={onAdd}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 text-sm font-medium transition">
          <Plus size={16} /> Dodaj zwierzę
        </button>
      )}
    </div>
  );
}

function Overlay({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-end sm:place-items-center p-0 sm:p-4 bg-stone-900/40 dark:bg-black/70"
      onClick={onClose}>
      <div className="w-full sm:w-auto flex justify-center" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function Info({ icon, label, value }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-stone-400 dark:text-stone-500">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-stone-400 dark:text-stone-500">{label}</div>
        <div className="text-sm break-words">{value || "—"}</div>
      </div>
    </div>
  );
}

function Detail({ a, isAdmin, onClose, onEdit, onDelete }) {
  return (
    <Overlay onClose={onClose}>
      <div className={cx("w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col", PANEL)}>
        <div className="relative">
          <Photo src={a.zdjecie} className="h-56 w-full" iconSize={36} />
          <button onClick={onClose} className="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 transition"><X size={18} /></button>
          <div className="absolute bottom-3 left-3"><StatusPill id={a.status} size="md" /></div>
        </div>
        <div className="p-5 overflow-y-auto">
          <h2 className="text-lg font-semibold leading-snug">{a.opis}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <Info icon={<Calendar size={15} />} label="Data odłowienia" value={fmtDate(a.data)} />
            <Info icon={<Building2 size={15} />} label="Gmina" value={a.gmina_name} />
            <Info icon={<MapPin size={15} />} label="Miejsce odłowienia" value={a.miejsce} />
            <Info icon={<ShieldCheck size={15} />} label="Zgłaszający" value={a.zglaszajacy} />
            <Info icon={<Cpu size={15} />} label="Nr chip" value={a.chip} />
            <Info icon={<ArrowRight size={15} />} label="Miejsce dostarczenia" value={a.dostarczenie} />
            <Info icon={<ClipboardList size={15} />} label="Dalszy los zwierzęcia" value={a.los} />
          </div>
          {a.notatka && (
            <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3">
              <div className="mb-1 flex items-center gap-2">
                <ClipboardList size={14} className="text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Notatka{isAdmin && (a.notatka_publiczna ? " — widoczna dla gminy" : " — tylko administrator")}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-stone-700 dark:text-stone-200">{a.notatka}</p>
            </div>
          )}
          {isAdmin && (
            <div className="mt-6 flex gap-2">
              <button onClick={onEdit} className={cx("flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 py-2.5 text-sm font-medium transition", SUBTLE_HOVER)}>
                <Pencil size={15} /> Edytuj
              </button>
              <button onClick={onDelete} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/10 text-red-500 px-4 py-2.5 text-sm font-medium hover:bg-red-500/20 transition">
                <Trash2 size={15} /> Usuń
              </button>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function FieldLabel({ children }) {
  return <span className="text-xs font-medium text-stone-500 dark:text-stone-400">{children}</span>;
}
function Field({ label, required, children }) {
  return (
    <div>
      <div className="mb-1.5"><FieldLabel>{label}{required && <span className="text-red-500"> *</span>}</FieldLabel></div>
      {children}
    </div>
  );
}

const NEW_GMINA = "__new__";
const capitalizeFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
function foldAscii(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L");
}
function genGminaCode(name, existingCodes) {
  const taken = new Set(existingCodes.map((c) => (c || "").toUpperCase()));
  const letters = foldAscii(name).toUpperCase().replace(/[^A-Z]/g, "");
  const base3 = (letters + "XXX").slice(0, 3);
  for (let n = 1; n < 10; n++) if (!taken.has(base3 + n)) return base3 + n;
  const base2 = (letters + "XX").slice(0, 2);
  for (let n = 10; n < 100; n++) if (!taken.has(base2 + n)) return base2 + n;
  return base3 + Math.floor(Math.random() * 10);
}

function EntryForm({ gminas, initial, onCancel, onSaved }) {
  const [f, setF] = useState(
    initial || {
      data: "", gmina_id: gminas[0]?.id || "", miejsce: "", zglaszajacy: "UG",
      opis: "", chip: "", dostarczenie: "", los: "", status: "przetrzymany",
      notatka: "", notatka_publiczna: false,
    }
  );
  const [photo, setPhoto] = useState(
    initial?.zdjecie ? { preview: initial.zdjecie, existing: true } : null
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newGmina, setNewGmina] = useState("");
  const fileRef = useRef(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { blob, url } = await compressImage(file);
      setPhoto({ blob, preview: url, existing: false });
    } catch { setErr("Nie udało się przetworzyć zdjęcia."); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!f.opis.trim()) return setErr("Podaj opis zwierzęcia.");

    let gminaId = f.gmina_id;
    let gminaName = "";

    if (gminaId === NEW_GMINA) {
      const name = capitalizeFirst(newGmina.trim());
      if (!name) return setErr("Wpisz nazwę nowej gminy.");
      setBusy(true); setErr("");
      const dupe = gminas.find((g) => g.name.toLowerCase() === name.toLowerCase());
      if (dupe) {
        gminaId = dupe.id; gminaName = dupe.name;
      } else {
        const newId = uid();
        const code = genGminaCode(name, gminas.map((g) => g.code));
        const list = [
          ...gminas.map((g) => ({ id: g.id, name: g.name, code: g.code })),
          { id: newId, name, code },
        ];
        const gr = await saveGminas(JSON.stringify(list));
        if (gr?.error) { setErr(gr.error); setBusy(false); return; }
        gminaId = newId; gminaName = name;
      }
    } else {
      if (!gminaId) return setErr("Wybierz gminę.");
      gminaName = gminas.find((x) => x.id === gminaId)?.name || "";
      setBusy(true); setErr("");
    }

    const fd = new FormData();
    ["data", "miejsce", "zglaszajacy", "opis", "chip", "dostarczenie", "los", "status"]
      .forEach((k) => fd.append(k, f[k] || ""));
    fd.append("notatka", f.notatka || "");
    fd.append("notatka_publiczna", f.notatka_publiczna ? "1" : "");
    fd.append("gmina_id", gminaId);
    fd.append("gmina_name", gminaName);
    if (photo?.blob) fd.append("photo", photo.blob, "photo.jpg");
    if (initial) {
      fd.append("id", initial.id);
      fd.append("existing_photo_path", initial.photo_path || "");
      if (!photo && initial.zdjecie) fd.append("removePhoto", "1");
    }
    const res = initial ? await updateAnimal(fd) : await createAnimal(fd);
    if (res?.error) { setErr(res.error); setBusy(false); return; }
    onSaved();
  };

  return (
    <Overlay onClose={onCancel}>
      <div className={cx("w-full max-w-lg max-h-[92vh] flex flex-col", PANEL)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
          <h2 className="font-semibold">{initial ? "Edytuj wpis" : "Nowe zwierzę"}</h2>
          <button onClick={onCancel} className={cx("p-1.5 rounded-lg transition", SUBTLE_HOVER)}><X size={18} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div>
            <div className="mb-1.5"><FieldLabel>Zdjęcie</FieldLabel></div>
            {photo?.preview ? (
              <div className="relative">
                <img src={photo.preview} alt="" className="h-44 w-full object-cover rounded-xl" />
                <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className={cx("w-full h-32 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 grid place-items-center transition", SUBTLE_HOVER)}>
                <div className="flex flex-col items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
                  {busy ? <span className="animate-pulse">Przetwarzanie…</span> : <><Upload size={22} /> Dodaj zdjęcie</>}
                </div>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          </div>

          <Field label="Opis zwierzęcia" required>
            <textarea rows={2} value={f.opis} onChange={(e) => { set("opis", e.target.value); setErr(""); }}
              placeholder="np. pies rudy mały mix" className={cx(INPUT, "resize-none")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data odłowienia">
              <input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} className={INPUT} />
            </Field>
            <Field label="Gmina" required>
              <select value={f.gmina_id} onChange={(e) => { set("gmina_id", e.target.value); setErr(""); }} className={cx(INPUT, "appearance-none")}>
                {gminas.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                <option value={NEW_GMINA}>➕ Dodaj gminę…</option>
              </select>
              {f.gmina_id === NEW_GMINA && (
                <input
                  autoFocus
                  value={newGmina}
                  onChange={(e) => { setNewGmina(e.target.value); setErr(""); }}
                  onBlur={() => setNewGmina((v) => capitalizeFirst(v.trim()))}
                  placeholder="Nazwa nowej gminy"
                  className={cx(INPUT, "mt-2")}
                />
              )}
            </Field>
          </div>

          <Field label="Miejsce odłowienia">
            <input value={f.miejsce} onChange={(e) => set("miejsce", e.target.value)} placeholder="np. Pniewo ul. Szkolna 15A" className={INPUT} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Zgłaszający">
              <select value={f.zglaszajacy} onChange={(e) => set("zglaszajacy", e.target.value)} className={cx(INPUT, "appearance-none")}>
                {REPORTERS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={f.status} onChange={(e) => set("status", e.target.value)} className={cx(INPUT, "appearance-none")}>
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Nr chip">
            <input value={f.chip} onChange={(e) => set("chip", e.target.value)} placeholder="opcjonalnie" className={INPUT} />
          </Field>

          <Field label="Miejsce dostarczenia">
            <input value={f.dostarczenie} onChange={(e) => set("dostarczenie", e.target.value)} placeholder="np. Schronisko Milanówek" className={INPUT} />
          </Field>

          <Field label="Dalszy los zwierzęcia">
            <textarea rows={2} value={f.los} onChange={(e) => set("los", e.target.value)}
              placeholder="np. Schronisko Milanówek 23.07.2026" className={cx(INPUT, "resize-none")} />
          </Field>

          <Field label="Notatka administratora">
            <textarea rows={2} value={f.notatka || ""} onChange={(e) => set("notatka", e.target.value)}
              placeholder="Notatka wewnętrzna — domyślnie widoczna tylko dla administratora"
              className={cx(INPUT, "resize-none")} />
            <label className="mt-2 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300 cursor-pointer select-none">
              <input type="checkbox" checked={!!f.notatka_publiczna}
                onChange={(e) => set("notatka_publiczna", e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500" />
              Widoczna również dla gminy
            </label>
          </Field>

          {err && <p className="text-sm text-red-500">{err}</p>}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-stone-200 dark:border-stone-800">
          <button onClick={onCancel} className={cx("flex-1 rounded-xl border border-stone-200 dark:border-stone-800 py-2.5 text-sm font-medium transition", SUBTLE_HOVER)}>Anuluj</button>
          <button onClick={submit} disabled={busy} className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white py-2.5 text-sm font-medium transition">
            {busy ? "Zapisywanie…" : "Zapisz"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function SettingsPanel({ gminas, exportPending, lastExportSentAt, selectedGmina, onClose, onSaved, onAcknowledged, onWipe }) {
  const [list, setList] = useState(gminas.map((g) => ({ ...g })));
  const [busy, setBusy] = useState(false);
  const [acking, setAcking] = useState(false);
  const [msg, setMsg] = useState("");
  const [exportGmina, setExportGmina] = useState(selectedGmina || "");
  const exportHref = (fmt) =>
    `/api/export?format=${fmt}${exportGmina ? `&gmina=${exportGmina}` : ""}`;
  const upd = (id, k, v) => setList((p) => p.map((g) => (g.id === id ? { ...g, [k]: v } : g)));
  const add = () => setList((p) => [...p, { id: uid(), name: "", code: "" }]);
  const rm = (id) => setList((p) => p.filter((g) => g.id !== id));

  const sentLabel = lastExportSentAt
    ? plLongDate(lastExportSentAt)
    : null;

  const acknowledge = async () => {
    setAcking(true);
    const res = await acknowledgeExport();
    if (res?.error) { setMsg(res.error); setAcking(false); return; }
    onAcknowledged();
  };

  const save = async () => {
    setBusy(true); setMsg("");
    const res = await saveGminas(JSON.stringify(list));
    if (res?.error) { setMsg(res.error); setBusy(false); return; }
    if (res?.warning) { setMsg(res.warning); setBusy(false); return; }
    onSaved();
  };

  return (
    <Overlay onClose={onClose}>
      <div className={cx("w-full max-w-lg max-h-[92vh] flex flex-col", PANEL)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
          <h2 className="font-semibold flex items-center gap-2"><Settings size={18} /> Ustawienia</h2>
          <button onClick={onClose} className={cx("p-1.5 rounded-lg transition", SUBTLE_HOVER)}><X size={18} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          <div>
            <FieldLabel>Kopia zapasowa</FieldLabel>
            {exportPending ? (
              <div className="mt-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4">
                <div className="flex gap-3">
                  <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Nowa kopia zapasowa</p>
                    <p className="text-xs mt-0.5 text-amber-800 dark:text-amber-300">
                      Wysłano na e-mail{sentLabel ? ` ${sentLabel}` : ""}. Zapisz pliki i potwierdź, aby wyłączyć przypomnienie.
                    </p>
                  </div>
                </div>
                <button onClick={acknowledge} disabled={acking}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-3 py-2 text-sm font-medium transition">
                  <Check size={15} /> {acking ? "Potwierdzanie…" : "Potwierdzam kopię"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                {sentLabel ? `Ostatnia kopia wysłana e-mailem: ${sentLabel}.` : "Kopia zapasowa wysyłana jest e-mailem co 5 dni."}
              </p>
            )}
            <div className="mt-3">
              <select value={exportGmina} onChange={(e) => setExportGmina(e.target.value)}
                className={cx(INPUT, "appearance-none")}>
                <option value="">Wszystkie gminy</option>
                {gminas.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <div className="mt-2 flex gap-2">
                <a href={exportHref("xlsx")}
                  className={cx("inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 px-3 py-2 text-sm font-medium transition", SUBTLE_HOVER)}>
                  <Download size={15} /> Excel
                </a>
                <a href={exportHref("csv")}
                  className={cx("inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 px-3 py-2 text-sm font-medium transition", SUBTLE_HOVER)}>
                  <Download size={15} /> CSV
                </a>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Gminy i ich kody</FieldLabel>
              <button onClick={add} className="text-xs font-medium text-teal-600 inline-flex items-center gap-1"><Plus size={13} /> Dodaj</button>
            </div>
            <div className="space-y-2">
              {list.map((g) => (
                <div key={g.id} className="flex gap-2">
                  <input value={g.name} onChange={(e) => upd(g.id, "name", e.target.value)} placeholder="Nazwa gminy" className={cx(INPUT, "flex-1 py-2")} />
                  <input value={g.code} onChange={(e) => upd(g.id, "code", e.target.value)} placeholder="KOD" maxLength={4}
                    className={cx(INPUT, "w-20 py-2 text-center uppercase tracking-wider")} />
                  <button onClick={() => rm(g.id)} className={cx("px-2.5 rounded-xl text-red-500 transition", SUBTLE_HOVER)}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">
              Każdej gminie przekaż jej 4-znakowy kod. Widzi wtedy tylko swoje zwierzęta.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700 p-4">
            <p className="text-sm font-medium">Kod administratora</p>
            <p className="text-xs mt-1 text-stone-500 dark:text-stone-400">
              Ustawiany w zmiennej <code className="rounded bg-stone-100 dark:bg-stone-800 px-1">ADMIN_CODE</code>.
              Zmiana wymaga ponownego uruchomienia aplikacji.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700 p-4">
            <p className="text-sm font-medium">Strefa niebezpieczna</p>
            <p className="text-xs mt-1 mb-3 text-stone-500 dark:text-stone-400">Trwale usuwa wszystkie wpisy zwierząt.</p>
            <button onClick={onWipe} className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 text-red-500 px-3 py-2 text-sm font-medium hover:bg-red-500/20 transition">
              <Trash2 size={15} /> Wyczyść wszystkie wpisy
            </button>
          </div>

          {msg && <p className="text-sm text-amber-600 dark:text-amber-400">{msg}</p>}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-stone-200 dark:border-stone-800">
          <button onClick={onClose} className={cx("flex-1 rounded-xl border border-stone-200 dark:border-stone-800 py-2.5 text-sm font-medium transition", SUBTLE_HOVER)}>Zamknij</button>
          <button onClick={save} disabled={busy} className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white py-2.5 text-sm font-medium transition">
            {busy ? "Zapisywanie…" : "Zapisz gminy"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}