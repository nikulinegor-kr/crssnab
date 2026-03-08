import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const DADATA_API_KEY = Deno.env.get("DADATA_API_KEY");
    if (!DADATA_API_KEY) {
      return new Response(
        JSON.stringify({ error: "DADATA_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, count = 5 } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if query is INN (digits only) or company name
    const isInn = /^\d+$/.test(query.trim());

    const dadataUrl = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party";

    const response = await fetch(dadataUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${DADATA_API_KEY}`,
      },
      body: JSON.stringify({
        query: query.trim(),
        count: Math.min(count, 10),
        ...(isInn ? { type: "LEGAL" } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DaData API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `DaData API error [${response.status}]` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    const suggestions = (data.suggestions || []).map((s: any) => ({
      name: s.value,
      inn: s.data?.inn || "",
      kpp: s.data?.kpp || "",
      ogrn: s.data?.ogrn || "",
      address: s.data?.address?.unrestricted_value || s.data?.address?.value || "",
      management_name: s.data?.management?.name || "",
      management_post: s.data?.management?.post || "",
      type: s.data?.type || "",
      opf_short: s.data?.opf?.short || "",
    }));

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in dadata-lookup:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
