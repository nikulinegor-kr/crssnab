export type AuthMode = "login" | "signup" | "forgot" | "reset";

export const DEFAULT_AUTH_DESTINATION = "/requests";
const AUTH_ENTRY_PATHS = new Set(["/", "/auth", "/employee-login"]);

/** Только внутренний рабочий адрес; внешние и зацикленные переходы заменяются заявками. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return DEFAULT_AUTH_DESTINATION;
  }

  try {
    const url = new URL(raw, "https://crss.internal");
    if (url.origin !== "https://crss.internal" || AUTH_ENTRY_PATHS.has(url.pathname)) {
      return DEFAULT_AUTH_DESTINATION;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_DESTINATION;
  }
}

export function parseAuthMode(raw: string | null): AuthMode {
  return raw === "signup" || raw === "forgot" || raw === "reset" ? raw : "login";
}
