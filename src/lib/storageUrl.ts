import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

/**
 * Parse a Supabase Storage URL (public or signed) to its bucket + path.
 * Returns null if the URL is not a recognizable storage URL.
 */
export function extractStoragePath(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (!m) return null;
  try {
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return { bucket: m[1], path: m[2] };
  }
}

/**
 * Resolve any stored storage URL (public or signed) to a fresh signed URL.
 * Falls back to the original URL if it can't be parsed.
 */
export async function resolveSignedUrl(url: string, expiresIn = 60 * 60): Promise<string> {
  const parsed = extractStoragePath(url);
  if (!parsed) return url;
  const { data } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, expiresIn);
  return data?.signedUrl ?? url;
}

/** Open a stored file in a new tab, resigning if needed. */
export async function openStoredFile(url: string) {
  const signed = await resolveSignedUrl(url);
  window.open(signed, "_blank", "noopener,noreferrer");
}

/** Trigger a browser download for a stored file, resigning if needed. */
export async function downloadStoredFile(url: string, suggestedName?: string) {
  const signed = await resolveSignedUrl(url);
  const a = document.createElement("a");
  a.href = signed;
  if (suggestedName) a.download = suggestedName;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * React hook: resolve a stored storage URL to a fresh signed URL.
 * Returns the original `url` until the signed URL is ready, so consumers
 * never render `undefined`.
 */
export function useSignedUrl(url: string | null | undefined, expiresIn = 60 * 60): string | undefined {
  const [signed, setSigned] = useState<string | undefined>(url ?? undefined);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setSigned(undefined);
      return;
    }
    setSigned(url);
    resolveSignedUrl(url, expiresIn).then((s) => {
      if (!cancelled) setSigned(s);
    });
    return () => {
      cancelled = true;
    };
  }, [url, expiresIn]);

  return signed;
}
