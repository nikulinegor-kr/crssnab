import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file, fileType } = await req.json();
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPdf = (fileType || "").includes("pdf") || file.startsWith("data:application/pdf");
    const userContent: any[] = [
      {
        type: "text",
        text: "Извлеки данные о перевозке из этого документа (ТТН, накладная, транспортная накладная и т.п.).",
      },
    ];
    if (isPdf) {
      userContent.push({ type: "file", file: { filename: "doc.pdf", file_data: file } });
    } else {
      userContent.push({ type: "image_url", image_url: { url: file } });
    }

    const messages: any[] = [
      {
        role: "system",
        content: `Ты парсер транспортных документов (ТТН, накладных, транспортных накладных).
Извлеки данные о перевозке и материалах. Верни ТОЛЬКО JSON строго в формате:
{
  "transport_company": "Название транспортной компании",
  "vehicle_number": "Госномер тягача/автомобиля (напр. А123БВ77)",
  "trailer_number": "Госномер прицепа если есть",
  "driver_name": "ФИО водителя",
  "driver_phone": "Телефон водителя",
  "waybill_number": "Номер ТТН/накладной",
  "load_date": "YYYY-MM-DD или пусто",
  "planned_arrival_date": "YYYY-MM-DD или пусто",
  "items": [
    { "material_name": "Название материала", "quantity": число, "unit": "шт/кг/м/т" }
  ]
}
Правила:
- Если поля нет — верни пустую строку "" (для items — пустой массив [])
- Даты только в формате YYYY-MM-DD
- quantity — число (без кавычек), unit — краткая единица
- Никакого markdown, только чистый JSON`,
      },
      { role: "user", content: userContent },
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
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} ${errText}`);
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    } catch {
      parsed = {};
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("recognize-shipment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
