import { supabase } from '@/integrations/supabase/client';
import { printLabels } from './warehouseLabels';

export async function warehouseRows<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}
export async function receiptLabels(documentId: string) {
  const lines = await warehouseRows<{ warehouse_units: { name: string; qr_token: string; serial_number: string | null; batch_number: string | null } | null }>((f,t) => supabase.from('warehouse_document_lines').select('warehouse_units(name, qr_token, serial_number, batch_number)').eq('document_id', documentId).order('id').range(f,t));
  await printLabels(lines.flatMap(l => l.warehouse_units ? [{ kind: 'unit' as const, token: l.warehouse_units.qr_token, title: l.warehouse_units.name, lines: [l.warehouse_units.serial_number ?? l.warehouse_units.batch_number ?? ''] }] : []));
}
export function validateSimpleIssue(recipient: string, date: string, equipmentId: string | null, objectId: string | null) {
  const errors: string[] = [];
  if (!recipient.trim()) errors.push('Укажите получателя');
  if (!date || Number.isNaN(Date.parse(date))) errors.push('Укажите дату выдачи');
  if (Boolean(equipmentId) === Boolean(objectId)) errors.push('Выберите технику либо объект');
  return errors;
}
