import { supabase } from '@/integrations/supabase/client';
import { printLabels, type LabelInput } from './warehouseLabels';

export type WarehouseDetails = { address: string; responsible: string };
export function warehouseDescription(details: WarehouseDetails) {
  return JSON.stringify({ warehouse_details: 1, address: details.address.trim(), responsible: details.responsible.trim() });
}
export function readWarehouseDescription(description: string | null): WarehouseDetails {
  try {
    const value = JSON.parse(description ?? '');
    if (value.warehouse_details === 1) return { address: typeof value.address === 'string' ? value.address : '', responsible: typeof value.responsible === 'string' ? value.responsible : '' };
  } catch { /* Existing free-text descriptions are preserved. */ }
  return { address: description ?? '', responsible: '' };
}
export function warehouseQuantity(balances: { unit_id: string; warehouse_id: string; quantity: number }[], unitId: string, warehouseId: string) {
  return balances.filter(b => b.unit_id === unitId && b.warehouse_id === warehouseId).reduce((total, b) => total + Number(b.quantity), 0);
}

export async function warehouseRows<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}
export async function loadReceiptLabels(documentId: string):Promise<LabelInput[]> {
  const {data:doc,error}=await supabase.from('warehouse_documents').select('requests!warehouse_documents_request_id_fkey(description,request_number)').eq('id',documentId).single();if(error)throw error;
  const lines = await warehouseRows<{ quantity:number; warehouse_units: { name: string; request_title:string|null;request_number:string|null;unit:string; qr_token: string; serial_number: string | null; batch_number: string | null } | null }>((f,t) => supabase.from('warehouse_document_lines').select('quantity,warehouse_units!warehouse_document_lines_unit_id_fkey(name,request_title,request_number,unit, qr_token, serial_number, batch_number)').eq('document_id', documentId).order('id').range(f,t));
  return lines.flatMap(l => {const u=l.warehouse_units;return u ? [{ kind: 'unit' as const, token: u.qr_token, title: u.request_title||doc.requests?.description||u.name, lines: [u.name,u.request_number||doc.requests?.request_number||'',`${l.quantity} ${u.unit}`,u.serial_number??''] }] : [];});
}
export async function receiptLabels(documentId:string) {
 await printLabels(await loadReceiptLabels(documentId));
}
export function validateSimpleIssue(recipient: string, date: string, equipmentId: string | null, objectId: string | null) {
  const errors: string[] = [];
  if (!recipient.trim()) errors.push('Укажите получателя');
  if (!date || Number.isNaN(Date.parse(date))) errors.push('Укажите дату выдачи');
  if (Boolean(equipmentId) === Boolean(objectId)) errors.push('Выберите технику либо объект');
  return errors;
}
