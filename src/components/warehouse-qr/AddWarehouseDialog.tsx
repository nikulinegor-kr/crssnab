import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { warehouseDescription, readWarehouseDescription } from '@/lib/simpleWarehouse';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export function AddWarehouseDialog({ open, onOpenChange, orgId, warehouse }: { open: boolean; onOpenChange: (open: boolean) => void; orgId: string;warehouse?:{id:string;name:string;description:string|null}|null }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [responsible, setResponsible] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const { toast } = useToast();
  useEffect(()=>{if(open){const details=readWarehouseDescription(warehouse?.description??null);setName(warehouse?.name??'');setAddress(details.address);setResponsible(details.responsible);setError('');}},[open,warehouse?.id]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const values={name:name.trim(),description:warehouseDescription({address,responsible})};
      const { data, error: failure } = warehouse ? await supabase.from('warehouses').update(values).eq('id',warehouse.id).eq('organization_id',orgId).select('id').single() : await supabase.from('warehouses').insert({organization_id:orgId,...values}).select('id').single();
      if (failure) throw failure;
      if(!data)throw Error('Склад недоступен');
      await Promise.all([qc.invalidateQueries({ queryKey: ['wh-qr', 'warehouses'] }), qc.invalidateQueries({ queryKey: ['warehouses'] })]);
      setName(''); setAddress(''); setResponsible(''); onOpenChange(false);
      toast({ title: warehouse?'Склад сохранён':'Склад добавлен' });
    } catch (e) { setError((e as { message?: string }).message ?? 'Не удалось добавить склад'); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!busy) { setError(''); onOpenChange(value); } }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{warehouse?'Редактировать склад':'Добавить склад'}</DialogTitle></DialogHeader>
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="warehouse-name">Название *</Label><Input id="warehouse-name" required value={name} onChange={e => setName(e.target.value)} className="min-h-11" /></div>
      <div className="space-y-2"><Label htmlFor="warehouse-address">Адрес</Label><Input id="warehouse-address" value={address} onChange={e => setAddress(e.target.value)} className="min-h-11" /></div>
      <div className="space-y-2"><Label htmlFor="warehouse-responsible">Ответственный</Label><Input id="warehouse-responsible" value={responsible} onChange={e => setResponsible(e.target.value)} className="min-h-11" /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => onOpenChange(false)}>Отмена</Button><Button type="submit" className="min-h-11" disabled={!name.trim() || busy}>{busy ? 'Сохранение…' : warehouse?'Сохранить':'Добавить склад'}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}