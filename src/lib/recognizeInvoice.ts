import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/functionError";
import type { RecognizedInvoice } from "@/lib/invoiceAutofill";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function recognizeInvoiceFile(file: File, mode: "all" | "items" = "all") {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const isSpreadsheet = ["xlsx", "xls", "csv", "ods"].includes(extension);
  let body: Record<string, unknown>;

  if (isSpreadsheet) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const textContent = workbook.SheetNames.map((name) =>
      `# Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`
    ).join("\n\n");
    body = { textContent, fileName: file.name, mode };
  } else {
    body = {
      file: await fileToBase64(file),
      fileName: file.name,
      fileType: file.type,
      mode,
    };
  }

  const { data, error } = await supabase.functions.invoke("recognize-invoice", { body });
  if (error) throw new Error(await getFunctionErrorMessage(error, "Не удалось обработать документ"));
  if (data?.error) throw new Error(data.error);
  let preparedFile: File | null = null;
  let preparationMessage = "";
  if (extension === "pdf" || file.type === "application/pdf") {
    try {
      const { prepareInvoiceInBrowser } = await import("./invoicePdfBrowser");
      const prepared = await prepareInvoiceInBrowser(file, data.preparation, Array.isArray(data.items) ? data.items : []);
      preparedFile = prepared.file;
      const removed = prepared.metadata.sourcePages - prepared.metadata.keptPages.length;
      preparationMessage = `Счёт подготовлен для ЗРС${removed ? `; убрано страниц: ${removed}` : ""}. Оригинал сохранён`;
    } catch (error) {
      preparationMessage = error instanceof Error ? error.message : "Не удалось подготовить PDF. Оригинал сохранён";
    }
  }
  return { ...data as RecognizedInvoice, preparedFile, preparationMessage };
}
