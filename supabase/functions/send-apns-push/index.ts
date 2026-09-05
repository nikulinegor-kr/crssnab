import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const APNS_KEY_P8 = Deno.env.get("APNS_KEY_P8");
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID");
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID");
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "app.lovable.p03d26285f32f457cbdfeb9b17be007d2";
const APNS_PRODUCTION = (Deno.env.get("APNS_PRODUCTION") ?? "true") === "true";
const APNS_HOOK_SECRET = Deno.env.get("APNS_HOOK_SECRET");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const b64url = (input: Uint8Array | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const pemToPkcs8 = (pem: string) => {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
};

let cachedJwt: { token: string; issuedAt: number } | null = null;

const getApnsJwt = async (): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 2400) return cachedJwt.token;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(APNS_KEY_P8!),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = b64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const payload = b64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }));
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${payload}`)),
  );
  const token = `${header}.${payload}.${b64url(signature)}`;
  cachedJwt = { token, issuedAt: now };
  return token;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const hook = req.headers.get("x-apns-hook");
    const authorized =
      (APNS_HOOK_SECRET && hook === APNS_HOOK_SECRET) ||
      req.headers.get("authorization") === `Bearer ${SERVICE_ROLE}`;
    if (!authorized) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const userIds: string[] = Array.isArray(body?.user_ids) ? body.user_ids.filter((v: unknown) => typeof v === "string") : [];
    const title = typeof body?.title === "string" ? body.title.slice(0, 200) : "CRSS";
    const message = typeof body?.body === "string" ? body.body.slice(0, 800) : "";
    const route = typeof body?.route === "string" ? body.route : null;

    if (userIds.length === 0) return json({ error: "user_ids is required" }, 400);

    if (!APNS_KEY_P8 || !APNS_KEY_ID || !APNS_TEAM_ID) {
      console.warn("[apns] credentials are not configured yet");
      return json({ skipped: true, reason: "apns_not_configured" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: tokens, error } = await admin
      .from("device_push_tokens")
      .select("token")
      .in("user_id", userIds)
      .eq("platform", "ios");

    if (error) return json({ error: error.message }, 500);
    if (!tokens?.length) return json({ sent: 0 });

    const jwt = await getApnsJwt();
    const host = APNS_PRODUCTION ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";

    let sent = 0;
    const invalid: string[] = [];

    await Promise.all(
      tokens.map(async ({ token }) => {
        const res = await fetch(`${host}/3/device/${token}`, {
          method: "POST",
          headers: {
            authorization: `bearer ${jwt}`,
            "apns-topic": APNS_BUNDLE_ID,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            aps: { alert: { title, body: message }, sound: "default", badge: 1 },
            route,
          }),
        });
        if (res.ok) {
          sent++;
        } else {
          const text = await res.text();
          if (res.status === 410 || text.includes("BadDeviceToken") || text.includes("Unregistered")) {
            invalid.push(token);
          } else {
            console.error("[apns] send failed", res.status, text);
          }
        }
      }),
    );

    if (invalid.length) {
      await admin.from("device_push_tokens").delete().in("token", invalid);
    }

    return json({ sent, removed: invalid.length });
  } catch (e) {
    console.error("[apns] error", e);
    return json({ error: String(e) }, 500);
  }
});
