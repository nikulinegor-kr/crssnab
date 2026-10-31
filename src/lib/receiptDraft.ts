/** Simple receipt scenario: only these canonical units are accepted for new data (server enforces the same). */
export const RECEIPT_UNITS = [{ value: 'шт', label: 'Шт' }, { value: 'комплект', label: 'Комплект' }] as const;
export type ReceiptUnit = typeof RECEIPT_UNITS[number]['value'];
export const isReceiptUnit = (u: string): u is ReceiptUnit => RECEIPT_UNITS.some(x => x.value === u);
/** kind is internal: new simple receipts are always one quantity position (batch) with one QR. */
export type ReceiptLine = { id: string | null; name: string; quantity: number | ''; kind: 'item' | 'batch'; unit: ReceiptUnit };
export function receiptDraft(items: {id:string;name:string;quantity:number}[], title:string): ReceiptLine[] {
 return items.length ? items.map(i=>({id:i.id,name:i.name,quantity:i.quantity,kind:'batch',unit:'шт'})) : [{id:null,name:title,quantity:'',unit:'шт',kind:'batch'}];
}
export function validReceiptLines(lines:ReceiptLine[]) {
 return lines.length>0 && lines.every(l=>l.name.trim() && typeof l.quantity==='number' && Number.isFinite(l.quantity) && l.quantity>0 && isReceiptUnit(l.unit) && (l.kind!=='item'||(Number.isInteger(l.quantity)&&l.quantity<=1000)));
}
