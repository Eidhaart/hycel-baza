import { getSession } from "../../../lib/session";
import { getServiceClient } from "../../../lib/supabase";
import PrintToolbar from "../PrintToolbar";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  schronisko: "W schronisku",
  zwrocony: "Zwrócony właścicielowi",
  rehabilitacja: "Lecznica Weterynaryjna",
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

export default async function SingleEntryPrint({ searchParams }) {
  const session = getSession();
  if (!session) return <Notice text="Musisz być zalogowany, aby wydrukować wpis." />;

  const id = (searchParams?.id || "").toString();
  if (!id) return <Notice text="Brak identyfikatora wpisu." />;

  const supabase = getServiceClient();
  const { data: a, error } = await supabase.from("animals").select("*").eq("id", id).single();
  if (error || !a) return <Notice text="Nie znaleziono wpisu." />;

  // A gmina session may only print its own gmina's entries.
  if (session.role === "gmina" && a.gmina_id !== session.gminaId) {
    return <Notice text="Brak dostępu do tego wpisu." />;
  }

  // The admin note prints only when it was marked visible to the gmina.
  const showNote = a.notatka && a.notatka_publiczna;

  const printedOn = plLongDate(new Date());

  const rows = [
    ["Data odłowienia", fmtDate(a.data)],
    ["Gmina", a.gmina_name],
    ["Miejsce odłowienia", a.miejsce],
    ["Zgłaszający", a.zglaszajacy],
    ["Nr chip", a.chip],
    ["Miejsce dostarczenia", a.dostarczenie],
    ["Dalszy los zwierzęcia", a.los],
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <PrintToolbar />

      <div className="sheet">
        <article className="card">
          {a.zdjecie ? (
            <div className="photo">
              <img src={a.zdjecie} alt="" />
              <span className="status">{STATUS_LABELS[a.status] || a.status || "—"}</span>
            </div>
          ) : (
            <div className="photo photo--empty">
              <span className="status status--solo">{STATUS_LABELS[a.status] || a.status || "—"}</span>
            </div>
          )}

          <div className="body">
            <h1>{a.opis || "—"}</h1>

            <dl className="fields">
              {rows.map(([label, value]) => (
                <div className="field" key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>

            {showNote && (
              <div className="note">
                <div className="note-label">Notatka</div>
                <p>{a.notatka}</p>
              </div>
            )}

            <div className="foot">Wydrukowano {printedOn} r. · Rejestr zwierząt Hycel</div>
          </div>
        </article>
      </div>
    </>
  );
}

function Notice({ text }) {
  return (
    <div style={{ padding: 40, fontFamily: "system-ui, sans-serif", color: "#1c1917" }}>
      <p>{text}</p>
    </div>
  );
}

const css = `
  @page { size: A4 portrait; margin: 14mm; }

  html, body { background: #ebebe8; margin: 0; padding: 0; color: #1c1917; }

  .sheet {
    display: flex;
    justify-content: center;
    padding: 28px 16px 60px;
  }

  .card {
    width: 100%;
    max-width: 640px;
    background: #fff;
    border: 1px solid #e7e5e4;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,.12);
    font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
  }

  .photo {
    position: relative;
    width: 100%;
    background: #f5f5f4;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
  }
  /* Fit the whole photo inside the box — never crop, never distort.
     A wide photo hits max-width first, a tall phone photo max-height. */
  .photo img {
    max-width: 100%;
    max-height: 150mm;
    width: auto;
    height: auto;
    display: block;
  }
  .photo--empty { min-height: 90px; }

  .status {
    position: absolute;
    bottom: 14px;
    left: 14px;
    background: #fdf0d3;
    color: #a16207;
    font-weight: 700;
    font-size: 14px;
    padding: 6px 14px;
    border-radius: 999px;
  }
  .status--solo { position: static; }

  .body { padding: 22px 24px 20px; }

  h1 { font-size: 22px; font-weight: 700; line-height: 1.25; margin: 0 0 18px; }

  .fields { margin: 0; display: grid; grid-template-columns: 1fr; gap: 14px; }
  .field { display: grid; grid-template-columns: 200px 1fr; gap: 12px; align-items: baseline; }
  .field dt { color: #78716c; font-size: 13px; margin: 0; }
  .field dd { margin: 0; font-size: 15px; font-weight: 500; color: #1c1917; }

  .note {
    margin-top: 18px;
    border: 1px solid #fde68a;
    background: #fffbeb;
    border-radius: 12px;
    padding: 12px 14px;
  }
  .note-label { font-size: 12px; font-weight: 600; color: #a16207; margin-bottom: 4px; }
  .note p { margin: 0; font-size: 14px; white-space: pre-wrap; color: #44403c; }

  .foot { margin-top: 22px; font-size: 11px; color: #a8a29e; }

  @media print {
    .no-print { display: none !important; }
    html, body { background: #fff; }
    .sheet { padding: 0; }
    .card {
      max-width: none;
      border: none;
      border-radius: 0;
      box-shadow: none;
    }
    .status, .note { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .photo img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;
