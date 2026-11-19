import "https://deno.land/x/xhr@0.1.0/mod.ts";

import { INVOICE_PREPARATION_RULES } from "../_shared/invoicePreparationPlan.ts";

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
    const { file, fileName, fileType, mode, textContent } = await req.json();

    if (!file && !textContent) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFinanceMode = mode === "finance";
    const isAllMode = mode === "all";

    const financeRules = `- "contractor" is the SUPPLIER (Поставщик) company name. Look for "Поставщик" or "Продавец", never "Покупатель". Extract the full legal name.
- "supplier_inn" is the supplier INN (ИНН), never the buyer INN. Return a string or empty.
- "invoice_number" is the invoice number as a STRING. Preserve every leading zero exactly as printed.
- "amount" is the total amount (Итого / Всего к оплате) as a number with kopecks, without currency symbols.`;
    const itemRules = `- "article" is the part number / SKU / артикул
- "name" is the product/item name
- "quantity" is the quantity (default 1 if not specified)
- "unit" is the unit of measure (единица измерения), for example "шт", "кг", "м", "упак"
- "price" is the unit price as a number with kopecks, or null if not found`;

    let systemPrompt = isAllMode
      ? `You are an invoice/receipt parser for Russian documents. Return ONLY a JSON object:
{"contractor": "string or empty", "supplier_inn": "string or empty", "invoice_number": "string or empty", "amount": number or null, "items": [{"article": "string or empty", "name": "string", "quantity": number, "unit": "string or empty", "price": number or null}]}
${financeRules}
${itemRules}
Do NOT include markdown, code fences, or extra text.`
      : isFinanceMode
      ? `You are an invoice/receipt parser for Russian documents. Return ONLY a JSON object:
{"contractor": "string or empty", "supplier_inn": "string or empty", "invoice_number": "string or empty", "amount": number or null}
${financeRules}
Do NOT include markdown, code fences, or extra text.`
      : `You are an invoice/receipt parser. Extract line items. Return ONLY a JSON object:
{"items": [{"article": "string or empty", "name": "string", "quantity": number, "unit": "string or empty", "price": number or null}]}
${itemRules}
Do NOT include markdown, code fences, or extra text.`;

    if (!textContent) systemPrompt += INVOICE_PREPARATION_RULES;

    const userPrompt = isAllMode
      ? "Extract the supplier, invoice number, total amount and every line item from this document:"
      : isFinanceMode
      ? "Extract the contractor name, supplier INN, invoice number, and total amount from this document:"
      : "Extract all line items with article, name, quantity, unit and price from this document:";

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    let mimeType = fileType || "image/png";
    let base64Data = file;
    let isPdf = false;

    if (textContent) {
      messages.push({
        role: "user",
        content: `${userPrompt}\n\n---\n${textContent}\n---`,
      });
    } else {
      if (typeof file === "string" && file.startsWith("data:")) {
        const match = file.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }
      isPdf = mimeType === "application/pdf" || fileName?.toLowerCase()?.endsWith(".pdf");

      const userContent: any[] = [{ type: "text", text: userPrompt }];
      if (isPdf) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:application/pdf;base64,${base64Data}` },
        });
      } else {
        userContent.push({ type: "image_url", image_url: { url: file } });
      }
      messages.push({ role: "user", content: userContent });
    }


    console.log("Sending request to AI gateway, mimeType:", mimeType, "isPdf:", isPdf, "mode:", mode || "items", "all:", isAllMode);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0,
        max_tokens: 24000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API error: ${response.status} ${errText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : isFinanceMode ? {} : { items: [] };
      if (isAllMode && parsed && !Array.isArray(parsed.items)) parsed.items = [];
    } catch {
      parsed = isFinanceMode ? {} : { items: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
