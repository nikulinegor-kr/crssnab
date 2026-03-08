import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file, fileName, fileType } = await req.json();

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isImage = fileType?.startsWith("image/");

    const messages: any[] = [
      {
        role: "system",
        content: `You are an invoice/receipt parser. Extract line items from the document. 
Return ONLY a JSON object with this structure:
{"items": [{"article": "string or empty", "name": "string", "quantity": number}]}
- "article" is the part number / SKU / артикул
- "name" is the product/item name
- "quantity" is the quantity (default 1 if not specified)
Do NOT include any markdown, code fences, or extra text. Return ONLY the JSON object.`,
      },
    ];

    if (isImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extract all line items (article, name, quantity) from this invoice image:" },
          { type: "image_url", image_url: { url: file } },
        ],
      });
    } else {
      // For PDF, send as base64 data
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extract all line items (article, name, quantity) from this invoice document:" },
          { type: "image_url", image_url: { url: file } },
        ],
      });
    }

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
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
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} ${errText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle possible markdown fences)
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [] };
    } catch {
      parsed = { items: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
