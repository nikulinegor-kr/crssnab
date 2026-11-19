import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Plus, Search, ArrowUpDown, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { WorkspacePanel, WorkspaceEmpty } from './WorkspacePanel';
import { supabase } from '@/integrations/supabase/client';
import type { Supplier } from '@/pages/Suppliers';

export function SuppliersWorkspace({ suppliers, loading, error, retry, search, onSearch, onCreate, onEdit, onDelete, onSort, stats, statsUnavailable, tools, selectedIds, onSelect }: {
  suppliers: Supplier[]; loading: boolean; error: boolean; retry: () => void; search: string; onSearch: (value: string) => void; onCreate: () => void; onEdit: (supplier: Supplier) => void; onDelete: (id: string) => void; onSort: () => void; stats: Map<string,{count:number;totalAmount:number}>; statsUnavailable: boolean; tools: ReactNode; selectedIds: Set<string>; onSelect: (id: string, checked: boolean) => void;
}) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [reliability, setReliability] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, category, reliability]);
  const selected = suppliers.find(s => s.id === selectedId);
  const rows = suppliers.filter(s => (!category || s.category === category) && (!reliability || s.reliability === reliability));
  const categories = [...new Set(suppliers.map(s => s.category).filter(Boolean))].sort();
  const reliabilityOptions = [...new Set(suppliers.map(s => s.reliability).filter(Boolean))].sort();
  const tone = (value: string) => value === 'Надёжный' ? 'green' : ['Риск','Заблокирован'].includes(value) ? 'red' : value === 'На проверке' ? 'orange' : 'gray';
  const count = selected ? stats.get(selected.name.toLowerCase().trim()) : null;
  const history = useQuery({ queryKey: ['workspace-supplier-history',selected?.organization_id,selected?.name], enabled: !!selected,
    queryFn: async () => { const {data,error} = await supabase.from('requests').select('id,description,status,amount,created_at').eq('organization_id',selected!.organization_id).ilike('contractor',selected!.name.replace(/[%_\\]/g,'\\$&')).order('created_at',{ascending:false}).limit(6); if(error) throw error; return data; } });
  const copy = async () => { if(!selected) return; try { await navigator.clipboard.writeText([selected.name,selected.phone,selected.email,selected.inn ? `ИНН ${selected.inn}` : null].filter(Boolean).join('\n')); toast.success('Контакты скопированы'); } catch { toast.error('Не удалось скопировать контакты'); } };
  return <div className="cw-workspace">
    <header className="cw-heading"><div><h1>Поставщики</h1><p>Контакты и история сотрудничества</p></div><div className="cw-heading-actions"><details className="cw-tools"><summary>Ещё</summary><div>{tools}</div></details><Button aria-label="Новый поставщик" onClick={onCreate}><Plus /><span>Новый поставщик</span></Button></div></header>
    <div className="cw-toolbar"><div className="cw-search"><Search /><Input value={search} onChange={e => onSearch(e.target.value)} placeholder="Название, ИНН, специализация или город" aria-label="Поиск поставщиков" /></div><select aria-label="Категория поставщика" value={category} onChange={e => setCategory(e.target.value)}><option value="">Все категории</option>{categories.map(value => <option key={value}>{value}</option>)}</select><select aria-label="Надёжность" value={reliability} onChange={e => setReliability(e.target.value)}><option value="">Любая надёжность</option>{reliabilityOptions.map(value => <option key={value}>{value}</option>)}</select><Button variant="outline" size="icon" onClick={onSort} aria-label="Изменить порядок по названию"><ArrowUpDown /></Button></div>
    <div className={`cw-grid ${selected ? 'has-detail' : ''}`}><div className="cw-main">
      {loading ? <Skeleton className="h-96 rounded-2xl" /> : error ? <WorkspaceEmpty><p role="alert">Не удалось загрузить поставщиков</p><Button onClick={retry}>Повторить</Button></WorkspaceEmpty> : !rows.length ? <WorkspaceEmpty><h2>{search || category || reliability ? 'Поставщики не найдены' : 'Добавьте первого поставщика'}</h2><p>Контакты и реквизиты будут под рукой.</p></WorkspaceEmpty> : <div className="cw-surface cw-directory"><div className="cw-table-scroll"><table className="cw-table"><colgroup><col style={{width:'34%'}}/><col style={{width:'25%'}}/><col style={{width:'24%'}}/><col style={{width:'17%'}}/></colgroup><thead><tr><th>Поставщик / специализация</th><th>Контакты</th><th>Надёжность</th><th className="numeric">Закупки</th></tr></thead><tbody>{rows.slice(page*40,page*40+40).map(s => <tr key={s.id} data-selected={selectedId === s.id}><td><div className="flex items-start gap-2"><Checkbox aria-label={`Выбрать ${s.name}`} checked={selectedIds.has(s.id)} onCheckedChange={value => onSelect(s.id,value === true)} /><div><button className="cw-name" onClick={() => setSelectedId(s.id)}>{s.name}</button><small>{s.nomenclature || s.category || 'Специализация не указана'}</small>{s.city && <small>{s.city}</small>}</div></div></td><td data-label="Контакт">{s.contact_person || 'Не указан'}<small>{s.phone || s.email || 'Контактов пока нет'}</small></td><td data-label="Надёжность"><span className={`cw-status ${tone(s.reliability)}`}>{s.reliability || 'Не проверен'}</span></td><td data-label="Закупки" className="numeric">{statsUnavailable ? '—' : stats.get(s.name.toLowerCase().trim())?.count ?? 0}<small>{statsUnavailable ? '—' : (stats.get(s.name.toLowerCase().trim())?.totalAmount ?? 0).toLocaleString('ru-RU')} ₽</small></td></tr>)}</tbody></table></div><footer className="cw-table-footer"><span>Поставщиков: {rows.length}</span><div className="flex gap-2"><Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p=>p-1)}>Назад</Button><Button variant="ghost" size="sm" disabled={(page+1)*40 >= rows.length} onClick={() => setPage(p=>p+1)}>Далее</Button></div></footer></div>}
    </div>{selected && <WorkspacePanel title={selected.name} subtitle={[selected.nomenclature || selected.category,selected.city].filter(Boolean).join(' · ')} badge={<span className={`cw-status ${tone(selected.reliability)}`}>{selected.reliability || 'Не проверен'}</span>} onClose={() => setSelectedId(null)} footer={<><Button variant="outline" onClick={() => { setSelectedId(null); onEdit(selected); }}>Редактировать</Button><Button onClick={() => navigate(`/requests?contractor=${encodeURIComponent(selected.name)}`)}>Заявки</Button></>}>
      <section className="cw-detail-section"><h3>Контакты</h3><dl className="cw-fields">{[['Контакт',selected.contact_person],['Телефон',selected.phone],['Почта',selected.email]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Не указан'}</dd></div>)}</dl><div className="cw-contact">{selected.phone && <Button variant="outline" asChild><a href={`tel:${selected.phone.replace(/[^+\d]/g,'')}`}><Phone size={15} />Позвонить</a></Button>}{selected.email && <Button variant="outline" asChild><a href={`mailto:${selected.email}`}><Mail size={15} />Написать</a></Button>}<Button variant="outline" onClick={() => void copy()}><Copy size={15} />Копировать</Button></div></section>
      <section className="cw-detail-section"><h3>Реквизиты</h3><dl className="cw-fields">{[['ИНН',selected.inn],['КПП',selected.kpp],['ОГРН',selected.ogrn],['Банк',selected.bank_name],['БИК',selected.bik],['Расчётный счёт',selected.bank_account],['Адрес',selected.address]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Не указан'}</dd></div>)}</dl></section>
      <section className="cw-detail-section"><h3>История закупок</h3><p>{statsUnavailable ? 'Сводка пока недоступна' : `${count?.count ?? 0} заявок · ${(count?.totalAmount ?? 0).toLocaleString('ru-RU')} ₽`}</p>{history.isError ? <p role="alert">Не удалось загрузить историю</p> : history.data?.map(r => <button key={r.id} className="cw-related" onClick={() => navigate(`/requests/${r.id}`)}>{r.description}<small>{r.status} · {Number(r.amount || 0).toLocaleString('ru-RU')} ₽</small></button>)}</section>
      <section className="cw-detail-section"><h3>Заметки</h3><p>{selected.notes || 'Заметок пока нет'}</p></section>
      <section className="cw-detail-section"><Button variant="ghost" className="text-destructive px-0" onClick={() => { if(window.confirm(`Удалить поставщика «${selected.name}»?`)) { onDelete(selected.id); setSelectedId(null); } }}>Удалить поставщика</Button></section>
    </WorkspacePanel>}</div>
  </div>;
}
