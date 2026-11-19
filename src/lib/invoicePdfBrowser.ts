import { expandKeepBands, validateInvoicePreparationPlan } from "../../supabase/functions/_shared/invoicePreparationPlan";
import { prepareInvoicePdf } from "./invoicePdf";

export async function prepareInvoiceInBrowser(file: File, plan: unknown, items: { name?: unknown }[]) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: workerUrl } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const bytes = new Uint8Array(await file.arrayBuffer());
  // PDF.js transfers its input buffer to its worker; keep a separate copy for pdf-lib.
  const loading = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false });
  const pdf = await loading.promise;
  try {
    const checked = validateInvoicePreparationPlan(plan, pdf.numPages, items.length);
    // Independently check digital text: recognizable product-name anchors may not
    // disappear from retained bands, even if the model claims a complete plan.
    const normalize = (value: string) => value.toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}]/gu, "");
    let originalText = "";
    let keptText = "";
    for (const pagePlan of checked.pages) {
      const page = await pdf.getPage(pagePlan.page);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const bands = expandKeepBands(pagePlan.regions, viewport.height, content.items.flatMap(item => {
        if (!("str" in item) || !item.str.trim()) return [];
        const point = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        return [{ top: point[1] - Math.max(item.height, 4), bottom: point[1] + Math.max(item.height, 4) * .25 }];
      }));
      for (const item of content.items) {
        if (!("str" in item)) continue;
        originalText += item.str + " ";
        const point = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        if (bands.some(band => point[1] >= band.top && point[1] <= band.bottom)) keptText += item.str + " ";
      }
    }
    const originalNames = normalize(originalText);
    const retainedNames = normalize(keptText);
    for (const item of items) {
      const name = normalize(typeof item.name === "string" ? item.name : "").slice(0,40);
      if (name.length >= 8 && originalNames.includes(name) && !retainedNames.includes(name)) throw new Error("Граница очистки затрагивает наименование товара. Оригинал сохранён; проверьте счёт");
    }
    const result = await prepareInvoicePdf(bytes, checked, items.length, async (pagePlan) => {
      const page = await pdf.getPage(pagePlan.page);
      const viewport = page.getViewport({ scale: 1 });
      const text = await page.getTextContent();
      const textBands = text.items.flatMap(item => {
        if (!("str" in item) || !item.str.trim()) return [];
        const point = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const height = Math.max(item.height, 4);
        return [{ top: point[1] - height, bottom: point[1] + height * .25 }];
      });
      const bands = expandKeepBands(pagePlan.regions, viewport.height, textBands);
      const scale = Math.min(2, 2400 / Math.max(viewport.width, viewport.height));
      const scaled = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(scaled.width); canvas.height = Math.ceil(scaled.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Не удалось обработать PDF на этом устройстве");
      try {
        await page.render({ canvasContext: context, canvas, viewport: scaled, background: "white" }).promise;
        const rendered = [];
        for (const band of bands) {
          const part = document.createElement("canvas");
          const y = Math.floor(band.top * scale);
          part.width = canvas.width; part.height = Math.ceil(band.bottom * scale) - y;
          const target = part.getContext("2d");
          if (!target) throw new Error("Не удалось обработать PDF");
          target.fillStyle = "white"; target.fillRect(0,0,part.width,part.height);
          target.drawImage(canvas, 0,y,canvas.width,part.height,0,0,part.width,part.height);
          const blob = await new Promise<Blob>((resolve,reject) => part.toBlob(value => value ? resolve(value) : reject(new Error("Не удалось сохранить страницу PDF")), "image/png"));
          rendered.push({ png: new Uint8Array(await blob.arrayBuffer()), width: viewport.width, height: part.height / scale });
          part.width = part.height = 0;
        }
        return { width: viewport.width, height: viewport.height, bands: rendered };
      } finally { canvas.width = canvas.height = 0; page.cleanup(); }
    });
    const name = file.name.replace(/\.pdf$/i, "") + ".prepared.pdf";
    return { file: new File([result.bytes as BlobPart], name, { type: "application/pdf" }), metadata: result.metadata };
  } finally { await loading.destroy(); }
}
