import QRCode from "qrcode";
import { qrPayload, type QrKind } from "./warehouseQr";

export interface LabelInput {
  kind: QrKind;
  token: string;
  title: string;
  lines: string[];
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Prints 58×40 mm labels through a hidden iframe. Same token → same QR on every reprint. */
export async function printLabels(labels: LabelInput[]) {
  const items = await Promise.all(
    labels.map(async (l) => ({
      ...l,
      img: await QRCode.toDataURL(qrPayload(l.kind, l.token), { errorCorrectionLevel: "M", margin: 0, width: 300 }),
    })),
  );
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Этикетки</title><style>
    @page { size: 58mm 40mm; margin: 0 }
    body { margin: 0; font-family: Manrope, Arial, sans-serif; }
    .l { width: 58mm; height: 40mm; box-sizing: border-box; padding: 2mm; display: flex; gap: 2mm; page-break-after: always; overflow: hidden }
    .l img { width: 30mm; height: 30mm; flex: none; align-self: center }
    .t { font-size: 10pt; font-weight: 700; line-height: 1.15; margin-bottom: 1mm; word-break: break-word }
    .s { font-size: 7.5pt; line-height: 1.2; word-break: break-word }
    .c { font-size: 6pt; color: #555; margin-top: 1mm; font-family: monospace }
  </style></head><body>${items
    .map(
      (l) => `<div class="l"><img src="${l.img}"/><div><div class="t">${esc(l.title)}</div>${l.lines
        .filter(Boolean)
        .map((x) => `<div class="s">${esc(x)}</div>`)
        .join("")}<div class="c">${esc(l.token.slice(-8).toUpperCase())}</div></div></div>`,
    )
    .join("")}</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); throw new Error("Не удалось открыть печать"); }
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((r) => setTimeout(r, 300));
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60_000);
}
