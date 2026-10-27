/**
 * Extracts a human-readable message from a backend function error.
 * When a function responds with a non-2xx status, the client only exposes a generic
 * message; the real reason is inside the response body (`{ error: "..." }`).
 */
export async function getFunctionErrorMessage(error: unknown, fallback = "Произошла ошибка"): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    try {
      const body = await ctx.clone().json();
      if (body && typeof body.error === "string" && body.error) return body.error;
      if (body && typeof body.message === "string" && body.message) return body.message;
    } catch {
      try {
        const text = await ctx.clone().text();
        if (text) return text;
      } catch {
        /* ignore */
      }
    }
  }
  const msg = (error as { message?: string })?.message;
  return msg || fallback;
}
