import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate date 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoISO = twoDaysAgo.toISOString();

    console.log(`[auto-archive] Looking for requests with status 'Доставлено' updated before ${twoDaysAgoISO}`);

    // Find requests to archive
    const { data: requestsToArchive, error: fetchError } = await supabase
      .from("requests")
      .select("id, request_number, organization_id")
      .eq("status", "Доставлено")
      .eq("archived", false)
      .lt("updated_at", twoDaysAgoISO);

    if (fetchError) {
      console.error("[auto-archive] Error fetching requests:", fetchError);
      throw fetchError;
    }

    if (!requestsToArchive || requestsToArchive.length === 0) {
      console.log("[auto-archive] No requests to archive");
      return new Response(
        JSON.stringify({ success: true, archived: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[auto-archive] Found ${requestsToArchive.length} requests to archive`);

    // Archive the requests
    const requestIds = requestsToArchive.map((r) => r.id);
    const { error: updateError } = await supabase
      .from("requests")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .in("id", requestIds);

    if (updateError) {
      console.error("[auto-archive] Error archiving requests:", updateError);
      throw updateError;
    }

    // Log activity for each archived request
    for (const request of requestsToArchive) {
      await supabase.from("request_activities").insert({
        request_id: request.id,
        organization_id: request.organization_id,
        action: "archived",
        description: "Заявка автоматически архивирована (2 дня после доставки)",
      });
    }

    console.log(`[auto-archive] Successfully archived ${requestsToArchive.length} requests`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        archived: requestsToArchive.length,
        request_numbers: requestsToArchive.map((r) => r.request_number)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[auto-archive] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
