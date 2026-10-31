// Pure helpers for permanent warehouse QR codes (no browser/DB dependencies).
export type QrKind = "cell" | "unit" | "request";
export type WarehouseDocType = "receipt" | "move" | "issue" | "return";

const PREFIX = "CRSS";
const KIND_CODE: Record<QrKind, string> = { cell: "C", unit: "U", request:"R" };

/** Payload printed into the QR. The token is permanent, so reprints are identical. */
export function qrPayload(kind: QrKind, token: string): string {
  if(kind==='request') return `/requests?request=${encodeURIComponent(token)}`;
  if(kind==='unit') return `/warehouse?qr=${encodeURIComponent(token)}`;
  return `${PREFIX}:${KIND_CODE[kind]}:${token}`;
}

/** Absolute link for printed QR so a plain phone camera opens the CRM. Preview hosts print the production domain. */
export function qrLink(kind: QrKind, token: string, origin: string): string {
  const payload = qrPayload(kind, token);
  if (!payload.startsWith('/')) return payload;
  const base = /lovable\.app|lovableproject\.com|localhost/.test(origin) ? 'https://crssnab.com' : origin;
  return new URL(payload, base).href;
}

/** Parses scanner/camera/manual input. Accepts full payload or bare token. */
export function parseQrInput(raw: string): { kind: QrKind | null; token: string } | null {
  // USB scanners on a Russian keyboard layout may type "СКЫЫ" etc.; normalise common cases.
  const value = raw.trim().replace(/\s+/g, "");
  if (!value) return null;
  try {const url=new URL(value,'https://local.invalid');const id=url.searchParams.get('request');if(url.pathname==='/requests'&&id&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return {kind:'request',token:id.toLowerCase()};}catch { /* Continue with permanent TMC formats. */ }
  try {const url=new URL(value,'https://local.invalid');const q=url.searchParams.get('qr');if(url.pathname.startsWith('/warehouse')&&q){const r=parseQrInput(decodeURIComponent(q));return r&&!r.kind?{kind:'unit',token:r.token}:r;}}catch { /* not a link */ }
  const m = /^CRSS[:;]([CU])[:;]([0-9a-f]{16,64})$/i.exec(value);
  if (m) return { kind: m[1].toUpperCase() === "C" ? "cell" : "unit", token: m[2].toLowerCase() };
  if (/^[0-9a-f]{32}$/i.test(value)) return { kind: null, token: value.toLowerCase() };
  return null;
}

export const DOC_TYPE_LABELS: Record<WarehouseDocType, string> = {
  receipt: "Приёмка",
  move: "Перемещение",
  issue: "Выдача",
  return: "Возврат",
};

export interface OperationDraft {
  type: WarehouseDocType;
  kind: "item" | "batch";
  quantity: number;
  available?: number; // for move/issue: balance at source place
  returnable?: number; // for return: issued - returned
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  fromCellId?: string | null;
  toCellId?: string | null;
  recipientName?: string;
  requestId?: string | null;
  objectId?: string | null;
  issueId?: string | null;
}

/** Client-side pre-check mirroring the server rules; the server remains authoritative. */
export function validateOperation(d: OperationDraft): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(d.quantity) || d.quantity <= 0) errors.push("Количество должно быть больше 0");
  if (d.kind === "item" && d.quantity !== 1) errors.push("Изделие учитывается поштучно: количество 1");
  if ((d.type === "receipt" || d.type === "move") && !d.toWarehouseId) errors.push("Укажите склад назначения");
  if ((d.type === "move" || d.type === "issue") && !d.fromWarehouseId) errors.push("Укажите место отправления");
  if ((d.type === "move" || d.type === "issue") && d.available !== undefined && d.quantity > d.available)
    errors.push(`Недостаточно остатка: доступно ${d.available}`);
  if (d.type === "move" && d.fromWarehouseId === d.toWarehouseId && (d.fromCellId ?? null) === (d.toCellId ?? null))
    errors.push("Место отправления и назначения совпадают");
  if (d.type === "issue") {
    if (!d.recipientName?.trim()) errors.push("Укажите получателя");
    if (!d.requestId && !d.objectId) errors.push("Укажите заявку или объект");
  }
  if (d.type === "return") {
    if (!d.issueId) errors.push("Выберите выдачу для возврата");
    else if (d.returnable !== undefined && d.quantity > d.returnable) errors.push(`Можно вернуть не больше ${d.returnable}`);
  }
  return errors;
}
