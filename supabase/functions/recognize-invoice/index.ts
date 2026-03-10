import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file, fileName, fileType, mode } = await req.json();

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFinanceMode = mode === "finance";

    const systemPrompt = isFinanceMode
      ? `You are an invoice/receipt parser. Extract the following financial details from the document.
Return ONLY a JSON object with this structure:
{"contractor": "string or empty", "invoice_number": "string or empty", "amount": number or null}
- "contractor" is the supplier/vendor company name (контрагент / поставщик)
- "invoice_number" is the invoice number (номер счёта)
- "amount" is the total amount in the document (сумма, итого)
Do NOT include any markdown, code fences, or extra text. Return ONLY the JSON object.`
      : `You are an invoice/receipt parser. Extract line items from the document. 
Return ONLY a JSON object with this structure:
{"items": [{"article": "string or empty", "name": "string", "quantity": number}]}
- "article" is the part number / SKU / артикул
- "name" is the product/item name
- "quantity" is the quantity (default 1 if not specified)
Do NOT include any markdown, code fences, or extra text. Return ONLY the JSON object.`;

    const userPrompt = isFinanceMode
      ? "Extract the contractor name, invoice number, and total amount from this invoice:"
      : "Extract all line items (article, name, quantity) from this invoice:";

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: file } },
        ],
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : isFinanceMode ? {} : { items: [] };
    } catch {
      parsed = isFinanceMode ? {} : { items: [] };
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
