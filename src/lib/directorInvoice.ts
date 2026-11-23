import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { wrapPdfText } from "./invoicePdf";

export const APPROVAL_STATUSES = ["Счёт на оплату", "Счет на оплату"];
export const directorPreferenceKey = (userId: string, orgId: string) => `crss:director:${orgId}:${userId}`;


export async function stampDirectorInvoice(source: ArrayBuffer, fontBytes: ArrayBuffer, signer: string, date: string) {
  const pdf = await PDFDocument.load(source);
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const page = pdf.getPages().at(-1);
  if (!page) throw new Error("PDF счёта пуст");
  const { width, height } = page.getSize();
  const lines = wrapPdfText(`${date} · ${signer}`, width - 48, font, 10);
  const stampHeight = 60 + 14 * lines.length;
  page.setSize(width, height + stampHeight);
  page.translateContent(0, stampHeight);
  const color = rgb(0.05, 0.36, 0.25);
  page.drawRectangle({ x: 18, y: 15, width: width - 36, height: stampHeight - 28, borderColor: color, borderWidth: 1 });
  page.drawText("В ОПЛАТУ", { x: 26, y: stampHeight - 32, size: 13, font, color });
  lines.forEach((line, index) => page.drawText(line, { x: 26, y: stampHeight - 47 - index * 14, size: 10, font, color }));
  return pdf.save({ useObjectStreams: true });
}
