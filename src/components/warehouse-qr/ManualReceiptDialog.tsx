import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LabelExporter } from './LabelExporter';
import { loadReceiptLabels } from '@/lib/simpleWarehouse';
import type { LabelInput } from '@/lib/warehouseLabels';

type Props = { open: boolean; onOpenChange: (v: boolean) => void; warehouseId: string; warehouseName: string };

export function ManualReceiptDialog({ open, onOpenChange, warehouseId, warehouseName }: Props) {
  const qc = useQueryClient();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(''), [kind, setKind] = useState<'batch' | 'item'>('batch'), [qty, setQty] = useState(''), [unit, setUnit] = useState('шт'), [code, setCode] = useState(''), [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [labels, setLabels] = useState<LabelInput[] | null>(null);
  useEffect(() => { if (open) { setKey(crypto.randomUUID()); setName(''); setKind('batch'); setQty(''); setUnit('шт'); setCode(''); setComment(''); setError(''); setLabels(null); } }, [open]);
  const save = async () => {
    const q = Number(qty.replace(',', '.'));
    if (!name.trim()) return setError('Укажите название ТМЦ');
    if (!(q > 0)) return setError('Укажите количество больше нуля');
    if (kind === 'item' && !Number.isInteger(q)) return setError('Количество изделий должно быть целым');
    if (!unit.trim()) return setError('Укажите единицу измерения');
    setBusy(true); setError('');
    try {
      const { data, error } = await supabase.rpc('manual_warehouse_receipt', { _operation_key: key, _warehouse_id: warehouseId, _name: name, _kind: kind, _quantity: q, _unit: unit, _code: code, _comment: comment });
      if (error) throw error;
      const doc = (data as { document_id: string }).document_id;
      await qc.invalidateQueries({ queryKey: ['wh-qr'] });
      setLabels(await loadReceiptLabels(doc));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v); }}>
    <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{labels ? 'ТМЦ добавлено — QR' : `Добавить ТМЦ · ${warehouseName}`}</DialogTitle></DialogHeader>
      {labels ? <><p className="text-sm text-muted-foreground">Остаток оприходован. QR постоянный — распечатайте и наклейте.</p><LabelExporter labels={labels} /><DialogFooter><Button className="min-h-11" onClick={() => onOpenChange(false)}>Готово</Button></DialogFooter></> : <>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="mr-name">Название *</Label><Input id="mr-name" value={name} onChange={e => setName(e.target.value)} className="min-h-11" /></div>
          <div className="space-y-1"><Label>Тип</Label><div className="flex gap-2"><Button type="button" variant={kind === 'batch' ? 'default' : 'outline'} className="min-h-11 flex-1" onClick={() => setKind('batch')}>Материал / партия</Button><Button type="button" variant={kind === 'item' ? 'default' : 'outline'} className="min-h-11 flex-1" onClick={() => setKind('item')}>Изделия поштучно</Button></div>
            <p className="text-xs text-muted-foreground">{kind === 'item' ? 'Каждый экземпляр получит свой QR.' : 'Один QR на всю партию с количеством.'}</p></div>
          <div className="flex gap-2"><div className="space-y-1 flex-1 min-w-0"><Label htmlFor="mr-qty">Количество *</Label><Input id="mr-qty" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} className="min-h-11" /></div><div className="space-y-1 w-28"><Label htmlFor="mr-unit">Ед. *</Label><Input id="mr-unit" value={unit} onChange={e => setUnit(e.target.value)} className="min-h-11" /></div></div>
          <div className="space-y-1"><Label htmlFor="mr-code">{kind === 'item' ? 'Серийный номер' : 'Партия / артикул'}</Label><Input id="mr-code" value={code} onChange={e => setCode(e.target.value)} className="min-h-11" /></div>
          <div className="space-y-1"><Label htmlFor="mr-comment">Примечание</Label><Input id="mr-comment" value={comment} onChange={e => setComment(e.target.value)} placeholder="Ранее приобретено" className="min-h-11" /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2"><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => onOpenChange(false)}>Отмена</Button><Button className="min-h-11" disabled={busy} onClick={save}>{busy ? 'Сохранение…' : 'Оприходовать и получить QR'}</Button></DialogFooter>
      </>}
    </DialogContent>
  </Dialog>;
}
