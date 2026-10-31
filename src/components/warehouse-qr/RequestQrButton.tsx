import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LabelExporter } from './LabelExporter';

export function RequestQrButton({ request }: { request: { id: string; description: string; request_number: string; status?: string | null } }) {
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState('1');
  const {data:people,error:peopleError,isLoading:peopleLoading}=useQuery({queryKey:['request-qr-people',request.id],enabled:open,queryFn:async()=>{const [{data:r,error:re},{data:receipt,error:ce}]=await Promise.all([supabase.from('requests').select('applicant').eq('id',request.id).single(),supabase.from('warehouse_request_receipts').select('receiver_name').eq('request_id',request.id).maybeSingle()]);if(re)throw re;if(ce)throw ce;return {applicant:r?.applicant,receiver:receipt?.receiver_name};}});
  const shipping = request.status === 'Готов к отгрузке';
  const n = Math.min(50, Math.max(1, Math.floor(Number(places)) || 1));
  const title = request.description || 'Заявка';
  const labels = Array.from({ length: n }, (_, i) => ({ kind: 'request' as const, token: request.id, title, ...people, lines: [ n > 1 ? `Место ${i + 1} из ${n}` : ''] }));
  return <>
    <Button variant={shipping ? 'default' : 'outline'} className="min-h-11" onClick={() => setOpen(true)}><QrCode className="h-4 w-4 mr-2" />{shipping ? 'QR для отгрузки' : 'QR заявки'}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle className="break-words">{title}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Маркировка до приёмки: QR привязан к заявке и не меняется. При получении скан откроет эту заявку для приёмки.</p>
      <div className="space-y-1 w-40"><Label htmlFor="qr-places">Мест (наклеек)</Label><Input id="qr-places" inputMode="numeric" value={places} onChange={e => setPlaces(e.target.value)} className="min-h-11" /></div>
      <>{peopleLoading?<p>Загрузка…</p>:peopleError?<p role="alert" className="text-destructive">{peopleError.message}</p>:<LabelExporter labels={labels} />}</>
    </DialogContent></Dialog>
  </>;
}
