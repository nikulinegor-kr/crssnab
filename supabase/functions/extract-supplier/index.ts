import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

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

    const { file, fileName, fileType } = await req.json();

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages: any[] = [
      {
        role: "system",
        content: `You are an invoice/document parser specializing in extracting supplier (vendor) details from Russian invoices (счета), commercial proposals (КП), and other financial documents.

Extract the SUPPLIER's (not buyer's) details from the document. The supplier is typically the organization issuing the invoice.

Return ONLY a JSON object with this exact structure:
{
  "supplier": {
    "name": "Full organization name including legal form (ООО, АО, ИП, etc.)",
    "inn": "INN number (10 or 12 digits)",
    "kpp": "KPP number (9 digits, empty for ИП)",
    "ogrn": "OGRN number (13 or 15 digits)",
    "bank_name": "Bank name",
    "bank_account": "Settlement account (расчетный счет, 20 digits)",
    "bik": "BIK number (9 digits)",
    "address": "Legal address",
    "phone": "Phone number if present",
    "email": "Email if present",
    "contact_person": "Contact person / director name if present"
  },
  "confidence": "high" | "medium" | "low"
}

Rules:
- Extract the SUPPLIER (поставщик / продавец / исполнитель), NOT the buyer (покупатель / заказчик)
- If a field is not found, use empty string ""
- Do NOT include markdown, code fences, or extra text
- Return ONLY the JSON object`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract the supplier/vendor details from this invoice document:",
          },
          { type: "image_url", image_url: { url: file } },
        ],
      },
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          temperature: 0.1,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} ${errText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { supplier: {}, confidence: "low" };
    } catch {
      parsed = { supplier: {}, confidence: "low" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in extract-supplier:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
