import { supabase } from "@/integrations/supabase/client";
import { extractStoragePath } from "@/lib/storageUrl";

export type RequestDocumentKind = "photo" | "document";

export type RequestDocumentRecord = {
  id: string;
  document_url?: string | null;
  document_urls?: string[] | null;
  photo_url?: string | null;
  photo_urls?: string[] | null;
};

export function getRequestFileUrls(request: RequestDocumentRecord, kind: RequestDocumentKind): string[] {
  const urls = kind === "photo" ? request.photo_urls : request.document_urls;
  const legacy = kind === "photo" ? request.photo_url : request.document_url;
  return [...new Set([...(urls ?? []), ...(legacy ? [legacy] : [])].filter(Boolean))];
}

export function getRequestFileRemovalPatch(
  request: RequestDocumentRecord,
  url: string,
  kind: RequestDocumentKind,
): Record<string, string[] | string | null> {
  const remaining = getRequestFileUrls(request, kind).filter((item) => item !== url);
  if (kind === "photo") {
    const legacy = request.photo_url && remaining.includes(request.photo_url) ? request.photo_url : remaining[0] ?? null;
    return { photo_urls: remaining, photo_url: legacy };
  }
  const legacy = request.document_url && remaining.includes(request.document_url) ? request.document_url : remaining[0] ?? null;
  return { document_urls: remaining, document_url: legacy };
}

/** Использует действующие RLS-права заявки и хранилища; сначала обновляет выбранную заявку. */
export async function deleteRequestFile(request: RequestDocumentRecord, url: string, kind: RequestDocumentKind) {
  const patch = getRequestFileRemovalPatch(request, url, kind);
  const { error } = await supabase.from("requests").update(patch).eq("id", request.id);
  if (error) throw error;

  const stored = extractStoragePath(url);
  if (stored) {
    const { error: storageError } = await supabase.storage.from(stored.bucket).remove([stored.path]);
    if (storageError) console.warn("Request file detached, storage cleanup failed", storageError);
  }
}

export function requestFileName(url: string): string {
  try {
    return decodeURIComponent(url.split("/").pop() || "Файл").replace(/^\d+-/, "");
  } catch {
    return "Файл";
  }
}
