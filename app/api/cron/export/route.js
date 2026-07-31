import { NextResponse } from "next/server";
import { getServiceClient } from "../../../../lib/supabase";
import { sendBackupEmail } from "../../../../lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export async function GET(request) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const supabase = getServiceClient();

  const { data: state } = await supabase
    .from("app_state")
    .select("last_export_sent_at")
    .eq("id", 1)
    .single();

  const last = state?.last_export_sent_at ? new Date(state.last_export_sent_at).getTime() : 0;
  const due = force || Date.now() - last >= FIVE_DAYS_MS;
  if (!due) {
    return NextResponse.json({ sent: false, reason: "not due yet", last_export_sent_at: state?.last_export_sent_at });
  }

  const { data: animals, error } = await supabase
    .from("animals")
    .select("*")
    .order("data", { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await sendBackupEmail(animals || []);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  await supabase.from("app_state").update({ last_export_sent_at: new Date().toISOString() }).eq("id", 1);
  return NextResponse.json({ sent: true, count: (animals || []).length });
}
