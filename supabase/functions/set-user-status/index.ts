import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Требуется авторизация" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return json({ success: false, error: "Неверный токен" }, 401);

    const body = await req.json();
    const organizationId: string = body.organizationId;
    const targetUserId: string = body.userId ?? body.targetUserId;
    const isActive: boolean | undefined = body.isActive;
    const plannerAccess: boolean | undefined = body.plannerAccess;
    const canManageTasks: boolean | undefined = body.canManageTasks;

    if (!organizationId || !targetUserId) {
      return json({ success: false, error: "Не указан пользователь или организация" }, 400);
    }

    const { data: isAdmin } = await anonClient.rpc("user_is_org_admin", {
      _user_id: user.id,
      _org_id: organizationId,
    });
    if (!isAdmin) return json({ success: false, error: "Недостаточно прав" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: membership } = await admin
      .from("user_organizations")
      .select("id, role")
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!membership) return json({ success: false, error: "Сотрудник не найден" }, 404);
    if (membership.role === "owner" && isActive === false) {
      return json({ success: false, error: "Нельзя отключить владельца организации" }, 400);
    }

    const patch: Record<string, unknown> = {};
    if (typeof isActive === "boolean") {
      patch.is_active = isActive;
      patch.deactivated_at = isActive ? null : new Date().toISOString();
      patch.deactivated_by = isActive ? null : user.id;
      if (!isActive) {
        patch.planner_access = false;
        patch.can_manage_tasks = false;
      }
    }
    if (typeof plannerAccess === "boolean" && isActive !== false) patch.planner_access = plannerAccess;
    if (typeof canManageTasks === "boolean" && isActive !== false) patch.can_manage_tasks = canManageTasks;

    const { error: updateError } = await admin
      .from("user_organizations")
      .update(patch)
      .eq("id", membership.id);
    if (updateError) throw updateError;

    // Block / restore login and terminate active sessions
    if (typeof isActive === "boolean") {
      const { error: banError } = await admin.auth.admin.updateUserById(targetUserId, {
        ban_duration: isActive ? "none" : "876000h",
      });
      if (banError) console.error("ban error", banError.message);
      if (!isActive) {
        try {
          await admin.auth.admin.signOut(targetUserId, "global");
        } catch (e) {
          console.error("signOut error", (e as Error).message);
        }
        await admin.from("device_push_tokens").delete().eq("user_id", targetUserId);
      }
    }

    await admin.rpc("log_audit_event", {
      _organization_id: organizationId,
      _action: "update",
      _entity_type: "user_access",
      _entity_id: membership.id,
      _new_values: patch,
    });

    return json({ success: true });
  } catch (error) {
    console.error("set-user-status error", error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
