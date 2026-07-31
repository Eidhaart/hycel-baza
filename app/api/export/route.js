import { getSession } from "../../../lib/session";
import { getServiceClient } from "../../../lib/supabase";
import { buildCsv, buildXlsx, exportFilename } from "../../../lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = getSession();
  if (!session || session.role !== "admin") {
    return new Response("Brak uprawnień.", { status: 403 });
  }

  const format = new URL(request.url).searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const supabase = getServiceClient();
  const { data: animals } = await supabase
    .from("animals")
    .select("*")
    .order("data", { ascending: false, nullsFirst: false });

  if (format === "xlsx") {
    return new Response(buildXlsx(animals || []), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFilename("xlsx")}"`,
      },
    });
  }
  return new Response(buildCsv(animals || []), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("csv")}"`,
    },
  });
}
