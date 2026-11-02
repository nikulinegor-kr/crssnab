import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MeSection, MeEmpty } from '@/components/me/MeSection';
import { fmtQty } from '@/lib/issueStatus';

/** Issues addressed to me personally that still wait for my "Получил". Never changes stock. */
export function MyIssuesSection() {
  const { toast } = useToast(); const qc = useQueryClient(); const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['wh-my-issues'], queryFn: async () => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return [];
    const { data, error } = await supabase.from('warehouse_issues').select('id,issued_qty,operation_date,created_at,warehouse_units!warehouse_issues_unit_id_fkey(name,unit)').eq('recipient_user_id', user.id).is('received_confirmed_at', null).order('created_at', { ascending: false }).limit(20);
    if (error) throw error; return data ?? [];
  } });
  const rows = q.data ?? [];
  if (!q.isLoading && !rows.length) return null;
  const confirm = async (id: string) => { setBusy(id); try { const { error } = await supabase.rpc('confirm_issue_received', { _issue_id: id }); if (error) throw error; await qc.invalidateQueries({ queryKey: ['wh-my-issues'] }); toast({ title: 'Получение подтверждено' }); } catch (e) { toast({ title: 'Не выполнено', description: (e as Error).message, variant: 'destructive' }); } finally { setBusy(null); } };
  return <MeSection title="Мне выдано — подтвердите получение" loading={q.isLoading} error={q.isError} rows={3}>{!rows.length ? <MeEmpty>Нет выдач</MeEmpty> : <div className="divide-y divide-border">{rows.map(r => <div key={r.id} className="flex items-center gap-2 py-2"><div className="min-w-0 flex-1"><p className="truncate text-sm">{r.warehouse_units?.name ?? '—'}</p><p className="text-xs text-muted-foreground font-numeric">{fmtQty(Number(r.issued_qty))} {r.warehouse_units?.unit} · {(r.operation_date ?? r.created_at.slice(0, 10)).split('-').reverse().join('.')}</p></div><Button className="min-h-11" disabled={busy === r.id} onClick={() => confirm(r.id)}>Получил</Button></div>)}</div>}</MeSection>;
}
