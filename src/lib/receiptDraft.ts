export type ReceiptLine = { id: string | null; name: string; quantity: number | ''; kind: 'item' | 'batch'; unit: string };
export function receiptDraft(items: {id:string;name:string;quantity:number}[], title:string): ReceiptLine[] {
 return items.length ? items.map(i=>({...i,kind:'batch',unit:'шт'})) : [{id:null,name:title,quantity:'',unit:'',kind:'batch'}];
}
export function validReceiptLines(lines:ReceiptLine[]) {
 return lines.length>0 && lines.every(l=>l.name.trim() && typeof l.quantity==='number' && Number.isFinite(l.quantity) && l.quantity>0 && l.unit.trim().length>0 && l.unit.trim().length<=40 && (l.kind!=='item'||(Number.isInteger(l.quantity)&&l.quantity<=1000)));
}
