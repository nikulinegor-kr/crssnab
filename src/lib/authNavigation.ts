export type AuthMode = "login" | "signup" | "forgot" | "reset";

/** Разрешены только локальные пути, чтобы next не мог увести на другой сайт. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/select-organization";
  return raw;
}

export function parseAuthMode(raw: string | null): AuthMode {
  return raw === "signup" || raw === "forgot" || raw === "reset" ? raw : "login";
}
