import { getSession } from "../lib/session";
import { getServiceClient } from "../lib/supabase";
import Login from "../components/Login";
import AppShell from "../components/AppShell";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = getSession();
  if (!session) return <Login />;

  try {
    const supabase = getServiceClient();

    let animalsQuery = supabase
      .from("animals")
      .select("*")
      .order("data", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (session.role === "gmina") {
      animalsQuery = animalsQuery.eq("gmina_id", session.gminaId);
    }

    const [{ data: animals, error: aErr }, { data: gminas, error: gErr }] = await Promise.all([
      animalsQuery,
      supabase.from("gminas").select("id, name, code").order("name"),
    ]);
    if (aErr) throw new Error(aErr.message);
    if (gErr) throw new Error(gErr.message);

    // Backup notification state (admin only). Missing app_state table is
    // non-fatal — the app still works, just without the backup badge.
    let exportPending = false;
    let lastExportSentAt = null;
    if (session.role === "admin") {
      try {
        const { data: state } = await supabase
          .from("app_state")
          .select("last_export_sent_at, last_export_acknowledged_at")
          .eq("id", 1)
          .single();
        lastExportSentAt = state?.last_export_sent_at || null;
        const sent = state?.last_export_sent_at ? new Date(state.last_export_sent_at).getTime() : 0;
        const ack = state?.last_export_acknowledged_at ? new Date(state.last_export_acknowledged_at).getTime() : 0;
        exportPending = sent > ack;
      } catch {
        /* app_state not set up yet — ignore */
      }
    }

    return (
      <AppShell
        session={session}
        initialAnimals={animals || []}
        gminas={gminas || []}
        exportPending={exportPending}
        lastExportSentAt={lastExportSentAt}
      />
    );
  } catch (e) {
    return <SetupError message={e?.message || String(e)} />;
  }
}

/* Server-rendered diagnostic screen — shows the real reason instead of a
   blank "Application error" digest page. */
function SetupError({ message }) {
  const m = (message || "").toLowerCase();
  let hint = "Sprawdź logi serwera (Vercel → Logs), aby poznać szczegóły.";
  if (/brak konfiguracji|supabase_url|service_role/.test(m)) {
    hint =
      "Zmienne SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY nie docierają do aplikacji. " +
      "Sprawdź je w Vercel → Settings → Environment Variables (zakres Production) i wykonaj ponowny deploy bez cache.";
  } else if (/app_state|does not exist|relation|schema cache|could not find/.test(m)) {
    hint =
      "Brakuje tabeli w bazie. Uruchom w Supabase → SQL Editor plik supabase/schema.sql " +
      "(lub supabase/migration-backup.sql, jeśli baza powstała wcześniej).";
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-stone-900 p-6">
        <h1 className="text-lg font-semibold">Coś jest nie tak z konfiguracją</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Aplikacja nie mogła się uruchomić. Poniżej rzeczywisty powód:
        </p>
        <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-stone-100 dark:bg-stone-800 p-3 text-xs text-red-600 dark:text-red-300">
          {message}
        </pre>
        <p className="mt-4 text-sm">{hint}</p>
      </div>
    </div>
  );
}
