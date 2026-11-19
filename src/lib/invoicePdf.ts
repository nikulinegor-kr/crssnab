import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { validateInvoicePreparationPlan, type InvoicePagePlan } from "../../supabase/functions/_shared/invoicePreparationPlan";

const PREFIX = "CRSS-INVOICE/1:";
export interface PreparedInvoiceMetadata {
  kind: "prepared" | "zrs";
  sourceSha256: string;
  sourcePages: number;
  itemCount: number;
  keptPages: number[];
  contentBottom: number; // points from top of last retained page
}
export interface RenderedInvoiceBand { png: Uint8Array; width: number; height: number }
export type InvoiceBandRenderer = (page: InvoicePagePlan) => Promise<{ width: number; height: number; bands: RenderedInvoiceBand[] }>;

export async function readPreparedInvoice(bytes: Uint8Array): Promise<PreparedInvoiceMetadata | null> {
  const doc = await PDFDocument.load(bytes);
  const subject = doc.getSubject();
  if (!subject?.startsWith(PREFIX)) return null;
  try {
    const data = JSON.parse(subject.slice(PREFIX.length)) as PreparedInvoiceMetadata;
    const last = doc.getPages().at(-1);
    if (data.kind !== "prepared" || !/^[a-f0-9]{64}$/.test(data.sourceSha256) || !last || data.keptPages?.length !== doc.getPageCount() || !Number.isFinite(data.contentBottom) || data.contentBottom < 0 || data.contentBottom > last.getHeight()) return null;
    return data;
  } catch { return null; }
}

/** Creates a separate raster-only PDF: discarded content is absent, not hidden by a white rectangle/crop. */
export async function prepareInvoicePdf(source: Uint8Array, planValue: unknown, itemCount: number, render: InvoiceBandRenderer) {
  const original = await PDFDocument.load(source);
  if (original.isEncrypted) throw new Error("Защищённый PDF нельзя подготовить автоматически");
  const plan = validateInvoicePreparationPlan(planValue, original.getPageCount(), itemCount);
  const doc = await PDFDocument.create();
  const keptPages: number[] = [];
  let contentBottom = 0;
  for (const pagePlan of plan.pages) {
    if (pagePlan.kind !== "invoice") continue;
    const rendered = await render(pagePlan);
    if (!rendered.bands.length || rendered.width < 100 || rendered.height < 100) throw new Error("Не удалось подготовить страницу счёта");
    const totalHeight = rendered.bands.reduce((sum, band) => sum + band.height, 0) + Math.max(0, rendered.bands.length - 1) * 8 + 40;
    const height = Math.max(rendered.height, totalHeight);
    const page = doc.addPage([rendered.width, height]);
    let top = 20;
    for (const band of rendered.bands) {
      const image = await doc.embedPng(band.png);
      page.drawImage(image, { x: 0, y: height - top - band.height, width: band.width, height: band.height });
      top += band.height + 8;
    }
    contentBottom = top - 8;
    keptPages.push(pagePlan.page);
  }
  const digest = await crypto.subtle.digest("SHA-256", source as BufferSource);
  const metadata: PreparedInvoiceMetadata = {
    kind: "prepared", sourceSha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join(""),
    sourcePages: original.getPageCount(), itemCount, keptPages, contentBottom,
  };
  doc.setTitle("Счёт — подготовлен для ЗРС");
  doc.setSubject(PREFIX + JSON.stringify(metadata));
  return { bytes: await doc.save(), metadata };
}

export function wrapPdfText(text: string, maxWidth: number, font: Pick<PDFFont, "widthOfTextAtSize">, size: number): string[] {
  const output: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue; }
      if (line) output.push(line);
      line = "";
      // IDs/URLs without spaces also wrap, never overflow the right edge.
      for (const letter of word) {
        if (line && font.widthOfTextAtSize(line + letter, size) > maxWidth) { output.push(line); line = ""; }
        line += letter;
      }
    }
    output.push(line);
  }
  return output;
}

/** Always starts from the prepared source, so repeated clicks cannot duplicate ZRS. */
export async function insertZrsIntoPreparedInvoice(source: Uint8Array, lines: string[], fontBytes: Uint8Array) {
  const metadata = await readPreparedInvoice(source);
  if (!metadata) throw new Error("Сначала распознайте и подготовьте исходный счёт");
  const doc = await PDFDocument.load(source);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const page = doc.getPages().at(-1)!;
  const width = page.getWidth();
  const fontSize = 9;
  const lineHeight = 13;
  const textWidth = Math.max(180, width * .49 - 24);
  const wrapped = lines.flatMap(line => wrapPdfText(line, textWidth, font, fontSize));
  const top = metadata.contentBottom + 24;
  const requiredHeight = top + 20 + wrapped.length * lineHeight + 24;
  if (requiredHeight > 14400) throw new Error("Сводка слишком большая для одного листа");
  const height = Math.max(page.getHeight(), requiredHeight);
  const extra = height - page.getHeight();
  if (extra) { page.setSize(width, height); page.translateContent(0, extra); }
  const x = width - textWidth - 24;
  page.drawLine({ start: { x, y: height - top }, end: { x: width - 24, y: height - top }, color: rgb(.8,.8,.8), thickness: .5 });
  let y = height - top - 16;
  page.drawText("ЗРС · Сводка заявки", { x, y, size: 10, font });
  y -= 18;
  for (const line of wrapped) {
    if (line) page.drawText(line, { x, y, size: fontSize, font, color: rgb(0,0,0) });
    y -= lineHeight;
  }
  doc.setSubject(PREFIX + JSON.stringify({ ...metadata, kind: "zrs" }));
  return doc.save();
}
