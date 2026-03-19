import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Standard construction section abbreviations
const SECTION_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bЭОМ\b/i, name: "ЭОМ" },
  { pattern: /\bЭС\b/i, name: "ЭС" },
  { pattern: /\bОВ(?:иК)?\b/i, name: "ОВ" },
  { pattern: /\bВК\b/i, name: "ВК" },
  { pattern: /\bАР\b/i, name: "АР" },
  { pattern: /\bКЖ\b/i, name: "КЖ" },
  { pattern: /\bКМ\b/i, name: "КМ" },
  { pattern: /\bСС\b/i, name: "СС" },
  { pattern: /\bТМ\b/i, name: "ТМ" },
  { pattern: /\bПС\b/i, name: "ПС" },
  { pattern: /\bАК\b/i, name: "АК" },
  { pattern: /\bНВК\b/i, name: "НВК" },
  { pattern: /\bНТС\b/i, name: "НТС" },
  { pattern: /\bПОС\b/i, name: "ПОС" },
  { pattern: /\bОДИ\b/i, name: "ОДИ" },
  { pattern: /\bИОС\b/i, name: "ИОС" },
  { pattern: /\bАСУ(?:ТП)?\b/i, name: "АСУ" },
  { pattern: /\bСКС\b/i, name: "СКС" },
  { pattern: /\bГП\b/i, name: "ГП" },
  { pattern: /\bТХ\b/i, name: "ТХ" },
  // "Раздел N" pattern
  { pattern: /раздел\s*(\d{1,3})/i, name: "Раздел $1" },
];

// Document type patterns
const DOC_TYPE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /(?:коммерческ|КП|предложен)/i, type: "kp" },
  { pattern: /(?:смет|локальн|сводн.*смет)/i, type: "estimate" },
  { pattern: /(?:ведомост|спецификац|перечень.*матер)/i, type: "statement" },
];

interface ExistingSection {
  id: string;
  name: string;
}

function matchSectionByFilename(
  fileName: string,
  existingSections: ExistingSection[]
): { sectionId: string | null; sectionName: string | null; confidence: number } {
  const baseName = fileName.replace(/\.[^.]+$/, "");

  // Step 1: Check standard abbreviations
  for (const sp of SECTION_PATTERNS) {
    const match = baseName.match(sp.pattern);
    if (match) {
      let detectedName = sp.name;
      if (match[1]) detectedName = detectedName.replace("$1", match[1]);

      // Find matching existing section
      const existing = existingSections.find(
        (s) => s.name.toLowerCase().includes(detectedName.toLowerCase()) ||
               detectedName.toLowerCase().includes(s.name.toLowerCase())
      );
      if (existing) {
        return { sectionId: existing.id, sectionName: existing.name, confidence: 0.9 };
      }
      return { sectionId: null, sectionName: detectedName, confidence: 0.7 };
    }
  }

  // Step 2: Fuzzy match against existing section names
  const normalizedFile = baseName.toLowerCase().replace(/[_\-\s.]+/g, " ");
  for (const sec of existingSections) {
    const secWords = sec.name.toLowerCase().split(/\s+/);
    const matchCount = secWords.filter(
      (w) => w.length > 1 && normalizedFile.includes(w)
    ).length;
    if (matchCount > 0 && matchCount / secWords.length >= 0.5) {
      return { sectionId: sec.id, sectionName: sec.name, confidence: 0.6 };
    }
  }

  return { sectionId: null, sectionName: null, confidence: 0 };
}

function detectDocType(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  for (const dt of DOC_TYPE_PATTERNS) {
    if (dt.pattern.test(baseName)) return dt.type;
  }
  return "statement"; // default
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { statementId, organizationId, objectId, fileName, fileUrl } = await req.json();

    if (!statementId || !organizationId || !objectId) {
      return new Response(
        JSON.stringify({ error: "statementId, organizationId, objectId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get existing sections for this object
    const { data: sectionsData } = await supabase
      .from("material_sections")
      .select("id, name")
      .eq("object_id", objectId);

    const existingSections: ExistingSection[] = (sectionsData || []) as ExistingSection[];

    // Check learned rules first
    const { data: rulesData } = await supabase
      .from("classification_rules")
      .select("pattern, section_name, doc_type")
      .eq("organization_id", organizationId);

    const rules = (rulesData || []) as Array<{ pattern: string; section_name: string; doc_type: string }>;
    const baseName = (fileName || "").replace(/\.[^.]+$/, "").toLowerCase();

    let sectionId: string | null = null;
    let sectionName: string | null = null;
    let docType = detectDocType(fileName || "");
    let confidence = 0;
    let method = "none";

    // Step 0: Check learned rules
    for (const rule of rules) {
      if (baseName.includes(rule.pattern.toLowerCase())) {
        const matchedSection = existingSections.find(
          (s) => s.name.toLowerCase() === rule.section_name.toLowerCase()
        );
        if (matchedSection) {
          sectionId = matchedSection.id;
          sectionName = matchedSection.name;
          docType = rule.doc_type || docType;
          confidence = 0.95;
          method = "learned_rule";
          break;
        }
      }
    }

    // Step 1: Filename pattern matching
    if (!sectionId && confidence < 0.5) {
      const fileResult = matchSectionByFilename(fileName || "", existingSections);
      if (fileResult.confidence > confidence) {
        sectionId = fileResult.sectionId;
        sectionName = fileResult.sectionName;
        confidence = fileResult.confidence;
        method = "filename";
      }
    }

    // Step 2: AI classification (if confidence still low and PDF available)
    if (confidence < 0.5 && fileUrl) {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableApiKey) {
        try {
          // Download first few KB of PDF for analysis
          const pdfResponse = await fetch(fileUrl, {
            headers: { Range: "bytes=0-524288" }, // First 512KB
          });

          if (pdfResponse.ok) {
            const pdfArrayBuffer = await pdfResponse.arrayBuffer();
            const pdfBase64 = btoa(
              new Uint8Array(pdfArrayBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ""
              )
            );

            const sectionsList = existingSections.map((s) => s.name).join(", ");

            const prompt = `Проанализируй этот строительный/проектный PDF документ.

Определи:
1. К какому разделу проекта относится этот документ.
   Существующие разделы: ${sectionsList || "нет"}
   Стандартные сокращения: ЭОМ, ОВ, ВК, АР, КЖ, КМ, СС, ТМ, ПС, АК, НВК, НТС, ПОС, ГП, ТХ, АСУ, СКС, ИОС
2. Тип документа: "statement" (ведомость/спецификация), "kp" (коммерческое предложение), "estimate" (смета), "drawing" (чертёж), "other"

Ответь СТРОГО в JSON:
{"section_name": "ОВ", "doc_type": "statement", "confidence": 0.8}

Если не можешь определить раздел, поставь section_name: null.
Не добавляй текст кроме JSON.`;

            const aiResponse = await fetch(
              "https://ai.gateway.lovable.dev/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${lovableApiKey}`,
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    {
                      role: "user",
                      content: [
                        { type: "text", text: prompt },
                        {
                          type: "image_url",
                          image_url: {
                            url: `data:application/pdf;base64,${pdfBase64}`,
                          },
                        },
                      ],
                    },
                  ],
                  temperature: 0.1,
                  max_tokens: 500,
                }),
              }
            );

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              let content =
                aiData.choices?.[0]?.message?.content || "{}";
              content = content
                .replace(/```json\s*/g, "")
                .replace(/```\s*/g, "")
                .trim();

              try {
                const aiResult = JSON.parse(content);
                if (aiResult.section_name && aiResult.confidence > 0.5) {
                  const matchedSection = existingSections.find(
                    (s) =>
                      s.name.toLowerCase() ===
                        aiResult.section_name.toLowerCase() ||
                      s.name
                        .toLowerCase()
                        .includes(aiResult.section_name.toLowerCase()) ||
                      aiResult.section_name
                        .toLowerCase()
                        .includes(s.name.toLowerCase())
                  );
                  sectionId = matchedSection?.id || null;
                  sectionName = aiResult.section_name;
                  docType = aiResult.doc_type || docType;
                  confidence = aiResult.confidence * 0.8; // discount AI confidence
                  method = "ai";
                }
              } catch {
                console.warn("Failed to parse AI response:", content);
              }
            }
          }
        } catch (aiErr) {
          console.warn("AI classification failed:", aiErr);
        }
      }
    }

    // Determine classification status
    const classificationStatus =
      confidence >= 0.5 ? "classified" : "unclassified";

    // If classified with high confidence, find the target folder
    let targetFolderId: string | null = null;
    let targetSectionId = sectionId;

    if (sectionId && confidence >= 0.5) {
      // Find the "Работы и материалы" folder for this section (for statements)
      // or "Общие документы" for other types
      const folderType =
        docType === "statement" || docType === "kp"
          ? "materials"
          : "general_docs";

      const { data: foldersData } = await supabase
        .from("material_folders")
        .select("id")
        .eq("section_id", sectionId)
        .eq("type", folderType)
        .limit(1);

      if (foldersData && foldersData.length > 0) {
        targetFolderId = (foldersData[0] as any).id;
      }
    }

    // Update the statement with classification results
    const updateData: Record<string, any> = {
      classification_status: classificationStatus,
      detected_doc_type: docType,
    };

    if (targetFolderId && targetSectionId) {
      updateData.folder_id = targetFolderId;
      updateData.section_id = targetSectionId;
    }

    await supabase
      .from("material_statements")
      .update(updateData)
      .eq("id", statementId);

    return new Response(
      JSON.stringify({
        success: true,
        sectionId: targetSectionId,
        sectionName,
        folderId: targetFolderId,
        docType,
        confidence,
        method,
        classificationStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
