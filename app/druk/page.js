import { getSession } from "../../lib/session";
import { getServiceClient } from "../../lib/supabase";
import PrintToolbar from "./PrintToolbar";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  schronisko: "W schronisku",
  zwrocony: "Zwrócony właścicielowi",
  rehabilitacja: "Rehabilitacja",
  przekazany: "Przekazany pod opiekę",
  przetrzymany: "Czasowo przetrzymany",
  adoptowany: "Adoptowany",
  inny: "Inny",
};

const PL_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];
function plLongDate(dt) {
  return `${dt.getDate()} ${PL_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}
function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export default async function PrintPage({ searchParams }) {
  const session = getSession();
  if (!session) return <Notice text="Musisz być zalogowany, aby wydrukować rejestr." />;

  const supabase = getServiceClient();

  // A gmina session is ALWAYS locked to its own gmina — the query parameter is
  // ignored for them, so the address bar cannot be edited to reach another
  // gmina's data. Only an admin may choose which gmina to print.
  let gminaId = null;
  let gminaName = null;
  if (session.role === "gmina") {
    gminaId = session.gminaId;
    gminaName = session.gminaName;
  } else if (searchParams?.gmina) {
    gminaId = searchParams.gmina;
    const { data: g } = await supabase.from("gminas").select("name").eq("id", gminaId).single();
    gminaName = g?.name || null;
  }

  const year = (searchParams?.rok || "").match(/^\d{4}$/)
    ? searchParams.rok
    : String(new Date().getFullYear());

  const withPhotos = searchParams?.foto !== "0";

  let q = supabase.from("animals").select("*");
  if (gminaId) q = q.eq("gmina_id", gminaId);
  const { data, error } = await q;
  if (error) return <Notice text={"Błąd bazy danych: " + error.message} />;

  const rows = (data || [])
    .filter((a) => a.data && a.data.startsWith(year))
    .sort((x, y) => (x.data || "").localeCompare(y.data || ""));

  const printedOn = plLongDate(new Date());

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css(withPhotos) }} />
      <PrintToolbar withPhotos={withPhotos} />

      <div className="page">
        <header className="doc-head">
          <p className="doc-date">dnia {printedOn} r.</p>
          <h1 className="doc-title">Rejestr zwierząt odłowionych</h1>
          <p className="doc-sub">
            {gminaName ? <>z terenu gminy <strong>{gminaName}</strong></> : <>ze wszystkich gmin</>}
            {" "}w <strong>{year}</strong> roku
          </p>
          <div className="rule" />
        </header>

        {rows.length === 0 ? (
          <p className="empty">Brak wpisów za {year} rok.</p>
        ) : (
          <div className="list">
            {rows.map((a, i) => (
              <article className="entry" key={a.id}>
                <div className="entry-body">
                  <div className="entry-head">
                    <span className="no">{i + 1}</span>
                    <h2 className="title">{a.opis || "—"}</h2>
                    {a.status && <span className="status">{STATUS_LABELS[a.status] || ""}</span>}
                  </div>

                  <dl className="fields">
                    <Field label="Data odłowienia" value={fmtDate(a.data)} />
                    <Field label="Zgłaszający" value={a.zglaszajacy} />
                    <Field label="Miejsce odłowienia" value={a.miejsce} wide />
                    <Field label="Nr chip" value={a.chip} mono />
                    <Field label="Miejsce dostarczenia" value={a.dostarczenie} wide />
                    {a.los ? <Field label="Dalszy los zwierzęcia" value={a.los} wide /> : null}
                  </dl>
                </div>

                {withPhotos && (
                  <div className="entry-photo">
                    {a.zdjecie
                      ? <img src={a.zdjecie} alt="" />
                      : <div className="nophoto">brak zdjęcia</div>}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="summary">
          Łączna liczba wpisów w {year} roku: <strong>{rows.length}</strong>
        </div>

        <div className="sign">
          <div className="sign-line" />
          <div className="sign-label">data i podpis osoby sporządzającej</div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, wide, mono }) {
  return (
    <div className={"f" + (wide ? " wide" : "")}>
      <dt>{label}</dt>
      <dd className={mono ? "mono" : ""}>{value || "—"}</dd>
    </div>
  );
}

function Notice({ text }) {
  return (
    <div style={{ padding: 40, fontFamily: "system-ui, sans-serif", color: "#1c1917" }}>
      <p>{text}</p>
    </div>
  );
}

function css(withPhotos) {
  return `
  @page { size: A4 portrait; margin: 16mm 15mm; }

  html, body { background: #f4f4f2; margin: 0; padding: 0; color: #111; }

  .page {
    background: #fff;
    max-width: 820px;
    margin: 24px auto 60px;
    padding: 32px 40px 44px;
    box-shadow: 0 1px 4px rgba(0,0,0,.14);
    font-family: "Segoe UI", system-ui, Arial, sans-serif;
    color: #1a1a1a;
  }

  .doc-head { margin-bottom: 22px; }
  .doc-date { text-align: right; font-size: 9.5pt; color: #444; margin: 0 0 14px; }
  .doc-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18pt; font-weight: 700; letter-spacing: .5px;
    text-align: center; text-transform: uppercase; margin: 0; line-height: 1.25;
  }
  .doc-sub { text-align: center; font-size: 11pt; color: #333; margin: 6px 0 0; }
  .doc-sub strong { font-weight: 600; }
  .rule { height: 2px; background: #1f2937; margin: 16px 0 0; }

  .list { margin-top: 8px; }

  .entry {
    display: flex;
    gap: 18px;
    align-items: flex-start;
    padding: 16px 0;
    border-bottom: 0.75pt solid #d8d8d4;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .entry-body { flex: 1; min-width: 0; }

  .entry-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 10px;
  }
  .entry-head .no {
    flex: 0 0 auto;
    min-width: 24px;
    height: 24px;
    border-radius: 999px;
    background: #0d9488;
    color: #fff;
    font-size: 10pt;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .entry-head .title {
    flex: 1;
    margin: 0;
    font-size: 12.5pt;
    font-weight: 700;
    line-height: 1.3;
    color: #111;
  }
  .entry-head .status {
    flex: 0 0 auto;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .4px;
    color: #0f766e;
    border: 0.75pt solid #99d6cf;
    border-radius: 999px;
    padding: 2px 9px;
    white-space: nowrap;
  }

  dl.fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 26px;
    margin: 0;
  }
  dl.fields .f { margin: 0; }
  dl.fields .f.wide { grid-column: 1 / -1; }
  dl.fields dt {
    font-size: 7.8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: #8a8a86;
    margin-bottom: 1px;
  }
  dl.fields dd {
    margin: 0;
    font-size: 10pt;
    line-height: 1.4;
    color: #1a1a1a;
  }
  dl.fields dd.mono { font-variant-numeric: tabular-nums; word-break: break-all; }

  .entry-photo {
    flex: 0 0 ${withPhotos ? "170px" : "0"};
    width: 170px;
  }
  .entry-photo img {
    display: block;
    width: 100%;
    height: 130px;
    object-fit: cover;
    border: 0.75pt solid #c9c9c4;
    border-radius: 3px;
  }
  .entry-photo .nophoto {
    width: 100%;
    height: 130px;
    border: 0.75pt dashed #cfcfca;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8pt;
    color: #b3b3ae;
  }

  .empty { font-size: 10.5pt; padding: 24px 0; text-align: center; color: #444; }

  .summary { margin-top: 16px; font-size: 9.5pt; }
  .summary strong { font-weight: 700; }

  .sign {
    margin-top: 48px;
    width: 260px;
    margin-left: auto;
    text-align: center;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sign-line { border-bottom: 0.75pt solid #4b5563; height: 0; }
  .sign-label { font-size: 8.5pt; color: #444; margin-top: 5px; }

  @media print {
    .no-print { display: none !important; }
    html, body { background: #fff; }
    .page { box-shadow: none; margin: 0; padding: 0; max-width: none; width: auto; }
    .doc-title, .entry-head .no {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
  `;
}
