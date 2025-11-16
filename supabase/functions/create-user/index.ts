import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    // Validate input with zod
    const schema = z.object({
      email: z.string().email().max(255),
      password: z.string().min(6).max(100),
      organizationId: z.string().uuid(),
      role: z.enum(['owner', 'admin', 'editor', 'viewer']),
      fullName: z.string().trim().min(1).max(100).optional(),
      position: z.string().trim().max(100).optional()
    });

    const validated = schema.parse(requestBody);

    // Create Supabase admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Validate organization exists
    const { data: orgExists } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("id", validated.organizationId)
      .single();
    
    if (!orgExists) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Организация не найдена" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user (profile will be created automatically by trigger)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: validated.email.trim().toLowerCase(),
      password: validated.password,
      email_confirm: true,
      user_metadata: {
        full_name: validated.fullName || "",
        position: validated.position || ""
      }
    });

    if (userError) {
      console.error("Error creating user:", userError);
      
      // Check if email already exists
      if (userError.message?.includes("already been registered") || userError.code === "email_exists") {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Пользователь с таким email уже существует" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Не удалось создать пользователя"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Wait a bit for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Add user to organization
    const { error: orgError } = await supabaseAdmin
      .from("user_organizations")
      .insert({
        user_id: userData.user.id,
        organization_id: validated.organizationId,
        role: validated.role,
      });

    if (orgError) {
      console.error("Error adding user to organization:", orgError);
      // Try to clean up
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Не удалось добавить пользователя в организацию" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: userData.user.id,
        email: userData.user.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Некорректные данные"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Произошла ошибка при создании пользователя" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
