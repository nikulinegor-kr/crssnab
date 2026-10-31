import { type QrKind } from "./warehouseQr";
import { labelPng, type LabelSize } from './labelPng';

export interface LabelInput {
  kind: QrKind;
  token: string;
  title: string;
  lines: string[];
}

/** Print the same locally rendered PNG used for file export. */
export async function printLabels(labels: LabelInput[], size: LabelSize = {width:60,height:40}) {
  const urls:string[]=[];
  try {
    for(const label of labels) urls.push(URL.createObjectURL(await labelPng(label,size)));
  } catch(e) { urls.forEach(url=>URL.revokeObjectURL(url));throw e; }
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>QR-наклейки</title><style>@page {size:${size.width}mm ${size.height}mm;margin:0}body{margin:0}img{display:block;width:${size.width}mm;height:${size.height}mm;break-after:page}</style></head><body>${urls.map(url=>`<img src="${url}"/>`).join('')}</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); throw new Error("Не удалось открыть печать"); }
  doc.open();
  doc.write(html);
  doc.close();
  await Promise.all(Array.from(doc.images).map(img=>img.decode()));
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => { frame.remove();urls.forEach(url=>URL.revokeObjectURL(url)); }, 60_000);
}
