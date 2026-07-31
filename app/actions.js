"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { getServiceClient, PHOTO_BUCKET } from "../lib/supabase";
import { getSession, setSession, clearSession } from "../lib/session";
import { validateCode } from "../lib/auth";

/* ------------------------------ auth ------------------------------ */

export async function login(code) {
  const session = await validateCode(code);
  if (!session) return { error: "Nieprawidłowy kod. Sprawdź i spróbuj ponownie." };
  setSession(session);
  revalidatePath("/");
  return { ok: true };
}

export async function logout() {
  clearSession();
  revalidatePath("/");
  return { ok: true };
}

function requireAdmin() {
  const s = getSession();
  if (!s || s.role !== "admin") throw new Error("Brak uprawnień administratora.");
  return s;
}

/* ---------------------------- photos ------------------------------ */

async function uploadPhoto(file) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) return null;
  const supabase = getServiceClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error("Nie udało się przesłać zdjęcia: " + error.message);
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

async function removePhoto(path) {
  if (!path) return;
  try {
    await getServiceClient().storage.from(PHOTO_BUCKET).remove([path]);
  } catch {
    /* non-fatal */
  }
}

/* ---------------------------- animals ----------------------------- */

function readFields(formData) {
  const g = (k) => (formData.get(k) ?? "").toString().trim();
  return {
    data: g("data") || null,
    gmina_id: g("gmina_id"),
    gmina_name: g("gmina_name"),
    miejsce: g("miejsce"),
    zglaszajacy: g("zglaszajacy"),
    opis: g("opis"),
    chip: g("chip"),
    dostarczenie: g("dostarczenie"),
    los: g("los"),
    status: g("status") || "przetrzymany",
  };
}

export async function createAnimal(formData) {
  requireAdmin();
  const supabase = getServiceClient();
  const fields = readFields(formData);
  if (!fields.opis) return { error: "Podaj opis zwierzęcia." };
  if (!fields.gmina_id) return { error: "Wybierz gminę." };

  const uploaded = await uploadPhoto(formData.get("photo"));
  const { error } = await supabase.from("animals").insert({
    ...fields,
    zdjecie: uploaded?.url || null,
    photo_path: uploaded?.path || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function updateAnimal(formData) {
  requireAdmin();
  const supabase = getServiceClient();
  const id = (formData.get("id") || "").toString();
  if (!id) return { error: "Brak identyfikatora wpisu." };
  const fields = readFields(formData);
  if (!fields.opis) return { error: "Podaj opis zwierzęcia." };
  if (!fields.gmina_id) return { error: "Wybierz gminę." };

  const existingPath = (formData.get("existing_photo_path") || "").toString();
  const wantsRemove = formData.get("removePhoto") === "1";
  const uploaded = await uploadPhoto(formData.get("photo"));

  const patch = { ...fields };
  if (uploaded) {
    patch.zdjecie = uploaded.url;
    patch.photo_path = uploaded.path;
    await removePhoto(existingPath);
  } else if (wantsRemove) {
    patch.zdjecie = null;
    patch.photo_path = null;
    await removePhoto(existingPath);
  }

  const { error } = await supabase.from("animals").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAnimal(id) {
  requireAdmin();
  const supabase = getServiceClient();
  const { data: row } = await supabase
    .from("animals")
    .select("photo_path")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("animals").delete().eq("id", id);
  if (error) return { error: error.message };
  if (row?.photo_path) await removePhoto(row.photo_path);
  revalidatePath("/");
  return { ok: true };
}

export async function wipeAllAnimals() {
  requireAdmin();
  const supabase = getServiceClient();
  const { data: rows } = await supabase.from("animals").select("photo_path");
  const paths = (rows || []).map((r) => r.photo_path).filter(Boolean);
  await supabase.from("animals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (paths.length) {
    try { await supabase.storage.from(PHOTO_BUCKET).remove(paths); } catch {}
  }
  revalidatePath("/");
  return { ok: true };
}

/* ----------------------------- gminy ------------------------------ */

export async function saveGminas(payload) {
  requireAdmin();
  const supabase = getServiceClient();
  let list;
  try {
    list = JSON.parse(payload);
  } catch {
    return { error: "Nieprawidłowe dane." };
  }

  const keep = list
    .map((g) => ({
      id: g.id,
      name: (g.name || "").trim(),
      code: (g.code || "").trim().toUpperCase(),
    }))
    .filter((g) => g.name && g.code);

  // Upsert the kept gminas.
  const { error: upErr } = await supabase.from("gminas").upsert(keep, { onConflict: "id" });
  if (upErr) return { error: upErr.message };

  // Delete gminas that were removed in the UI, unless they still have animals.
  const { data: existing } = await supabase.from("gminas").select("id");
  const keepIds = new Set(keep.map((g) => g.id));
  const toDelete = (existing || []).map((g) => g.id).filter((id) => !keepIds.has(id));

  const skipped = [];
  for (const id of toDelete) {
    const { count } = await supabase
      .from("animals")
      .select("id", { count: "exact", head: true })
      .eq("gmina_id", id);
    if (count && count > 0) {
      skipped.push(id);
      continue;
    }
    await supabase.from("gminas").delete().eq("id", id);
  }

  revalidatePath("/");
  return skipped.length
    ? { ok: true, warning: "Niektórych gmin nie usunięto, bo mają przypisane zwierzęta." }
    : { ok: true };
}

/* ---------------------------- backups ----------------------------- */

// Admin confirms they've saved the latest backup — clears the notification.
export async function acknowledgeExport() {
  requireAdmin();
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("app_state")
    .update({ last_export_acknowledged_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}
