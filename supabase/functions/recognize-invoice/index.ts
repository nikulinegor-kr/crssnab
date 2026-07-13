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
    const { file, fileName, fileType, mode, textContent } = await req.json();

    if (!file && !textContent) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFinanceMode = mode === "finance";

    const systemPrompt = isFinanceMode
      ? `You are an invoice/receipt parser for Russian documents. Extract the following financial details from the document.
Return ONLY a JSON object with this structure:
{"contractor": "string or empty", "invoice_number": "string or empty", "amount": number or null}
- "contractor" is the SUPPLIER (Поставщик) company name. Look for the field labeled "Поставщик" or "Продавец". It typically starts with "ООО", "ИП", "АО", "ПАО", "ЗАО" followed by the company name in quotes. Extract the full legal name including the organizational form (e.g. "ООО \"Компания\"", "ИП Иванов И.И."). Do NOT use the "Покупатель" (buyer) field.
- "invoice_number" is the invoice number (номер счёта). Look for "Счет №" or "Счёт на оплату №" in the document header.
- "amount" is the total amount (Итого / Всего к оплате) as a number without currency symbols.
Do NOT include any markdown, code fences, or extra text. Return ONLY the JSON object.`
      : `You are an invoice/receipt parser. Extract line items from the document. 
Return ONLY a JSON object with this structure:
{"items": [{"article": "string or empty", "name": "string", "quantity": number}]}
- "article" is the part number / SKU / артикул
- "name" is the product/item name
- "quantity" is the quantity (default 1 if not specified)
Do NOT include any markdown, code fences, or extra text. Return ONLY the JSON object.`;

    const userPrompt = isFinanceMode
      ? "Extract the contractor name, invoice number, and total amount from this document:"
      : "Extract all line items (article, name, quantity) from this document:";

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


    console.log("Sending request to AI gateway, mimeType:", mimeType, "isPdf:", isPdf, "mode:", mode || "items");

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
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API error: ${response.status} ${errText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    console.log("AI response content:", content.substring(0, 500));

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
    console.error("Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
