import { useState, useMemo, useEffect, lazy, Suspense, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO, startOfDay, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowRight, RefreshCw, CircleHelp } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useExecutivePanel } from "@/hooks/useExecutivePanel";
import { useExecutivePeriod } from "@/hooks/useExecutivePeriod";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import type { PlannerTask } from "@/hooks/usePlannerTasks";
import { buildExecutiveSnapshot, buildExecutiveTeam, plannedArrival, type Decision } from "@/lib/executiveInsights";
import { ExecObjectsLoad } from "@/components/executive/ExecObjectsLoad";
import { ExecRecentEvents } from "@/components/executive/ExecRecentEvents";
import { EXEC_LINKS, execRequestLink, formatExecFullAmount, formatExecAmount } from "@/lib/executivePanel";
import { Skeleton } from "@/components/ui/skeleton";
import "@/components/executive/executivePanel.css";
import "@/components/executive/executivePanelRefinement.css";

const TaskDialog = lazy(() => import("@/components/planner/PlannerTaskDialog").then(m => ({ default: m.PlannerTaskDialog })));
const taskColumns = "id,organization_id,object_id,stage_id,request_id,equipment_id,equipment_ids,parent_task_id,title,description,status,priority,assignee_id,reviewer_id,co_assignee_ids,department_id,requires_acceptance,accepted_at,blocked_reason,blocked_until,change_reason,created_by,start_date,due_date,completed_at,position,tags,checklist,attachments,is_private,recurrence,estimated_hours,actual_hours,source,source_rule,due_time,archived_at,created_at,updated_at";
const FILTERS = [{ key: "all", label: "Все" }, { key: "payment", label: "Оплата" }, { key: "delivery", label: "Поставки" }, { key: "task", label: "Задачи" }, { key: "stale", label: "Без движения" }] as const;
const money = (n: number) => formatExecFullAmount(Math.round(n * 100) / 100);
function SectionHead({ title, caption, children }: { title: string; caption?: string; children?: ReactNode }) { return <div className="exec-head"><div><h2>{title}</h2>{caption && <p>{caption}</p>}</div>{children}</div>; }
function LoadState({ loading, error, empty, children }: { loading: boolean; error: boolean; empty?: boolean; children: ReactNode }) {
 return loading ? <Skeleton className="h-28 w-full rounded-xl" /> : error ? <p role="alert" className="exec-error">Не удалось загрузить данные. Нажмите «Обновить данные».</p> : empty ? <p className="exec-empty">Записей с этими условиями нет.</p> : <>{children}</>;
}
export default function ExecutivePanelPage({ embedded = false }: { embedded?: boolean }) {
 const panel = useExecutivePanel(), qc = useQueryClient(), { hasRouteAccess } = useUserPermissions();
 const [now, setNow] = useState(() => new Date());
 // Refresh the calendar boundary without polling the database while the tab is idle.
 useEffect(() => { const timer = setTimeout(() => setNow(new Date()), Math.max(1000, addDays(startOfDay(now), 1).getTime() - Date.now() + 1000)); return () => clearTimeout(timer); }, [now]);
 const [period, setPeriod] = useState("year"), [filter, setFilter] = useState("all"), [expanded, setExpanded] = useState(false);
 const [quality, setQuality] = useState<string | null>(null), [task, setTask] = useState<PlannerTask | null>(null), [openingTask, setOpeningTask] = useState(false), [refreshing, setRefreshing] = useState(false);
 const canReadWarehouse = hasRouteAccess("/warehouse");
 const from = period === "week" ? startOfDay(addDays(now, -6)) : period === "quarter" ? startOfQuarter(now) : period === "year" ? startOfYear(now) : startOfMonth(now);
 const events = useExecutivePeriod(panel.orgId, format(from, "yyyy-MM-dd"), format(addDays(startOfDay(now), 1), "yyyy-MM-dd"), canReadWarehouse);
 const requests = panel.requestAttention.data?.requests ?? [], overdueTasks = panel.taskAttention.data ?? [];
 const snapshot = useMemo(() => buildExecutiveSnapshot(requests, overdueTasks, now), [panel.requestAttention.data, panel.taskAttention.data, now]);
 const team = useMemo(() => buildExecutiveTeam(snapshot.open, events.completed.data ?? [], overdueTasks), [snapshot, events.completed.data, panel.taskAttention.data]);
 const rows = snapshot.decisions.filter(d => filter === "all" || d.kinds.includes(filter as Decision["kind"]));
 const selectedQuality = snapshot.quality.find(q => q.key === quality);
 const sourcesError = panel.requestAttention.isError || panel.taskAttention.isError;
 const queueLoading = panel.requestAttention.isLoading || panel.taskAttention.isLoading;
 const percentPaid = snapshot.finance.paid + snapshot.finance.outstanding ? 100 * snapshot.finance.paid / (snapshot.finance.paid + snapshot.finance.outstanding) : 0;
 const openTask = async (id: string) => {
  if (!panel.orgId || openingTask) return; setOpeningTask(true);
  try { const { data, error } = await supabase.from("planner_tasks").select(taskColumns).eq("organization_id", panel.orgId).eq("id", id).single(); if (error) throw error; setTask(data as unknown as PlannerTask); }
  catch { toast.error("Не удалось открыть задачу"); } finally { setOpeningTask(false); }
 };
 const refresh = async () => { setRefreshing(true); setNow(new Date()); try { await qc.invalidateQueries({ queryKey: ["executive", panel.orgId] }); } finally { setRefreshing(false); } };
 const decisionLink = (d: Decision, children: ReactNode, className?: string) => d.taskId ? <button className={className} onClick={() => openTask(d.taskId!)} disabled={openingTask}>{children}</button> : <Link className={className} to={execRequestLink(d.requestId!)}>{children}</Link>;
 const metric = (m: { data?: number; isError: boolean; isLoading: boolean }) => m.isLoading || m.isError ? "—" : m.data ?? 0;
 const docs = events.warehouse.data ?? [];
 const warehouseRows = [{ label: "Приходы", count: docs.filter(d => d.doc_type === "receipt").length }, { label: "Выдачи сотрудникам", count: docs.filter(d => d.doc_type === "issue").length }, { label: "Перемещения", count: docs.filter(d => ["move", "transfer"].includes(d.doc_type)).length }];
 const otherDocs = docs.length - warehouseRows.reduce((n, r) => n + r.count, 0);
 return <div className={embedded ? "exec-panel exec-panel-embedded" : "exec-panel"} aria-busy={openingTask}>
  <header className="exec-title"><div>{embedded ? <h2>Аналитика руководителя</h2> : <h1>Панель руководителя</h1>}<p>{format(now, "d MMMM, EEEE", { locale: ru })}{panel.requestAttention.dataUpdatedAt > 0 && <> · Заявки обновлены в {format(panel.requestAttention.dataUpdatedAt, "HH:mm")}</>}</p></div><button className="exec-button" aria-label="Обновить данные" onClick={refresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /><span>{refreshing ? "Обновление…" : "Обновить данные"}</span></button></header>
  {!panel.orgId ? <p className="exec-empty">Выберите организацию</p> : <>
   <section className="exec-snapshot" aria-label="Текущая ситуация"><div className="exec-snapshot-label"><h2>Сейчас</h2><p>Все открытые заявки</p></div><div className="exec-summary">
    <Link to={EXEC_LINKS.openRequests}><span>В работе</span><strong>{metric(panel.openRequests)} <small>заявок</small></strong></Link>
    <a href="#exec-finance"><span>Счётов на оплату</span><strong>{panel.requestAttention.isLoading || panel.requestAttention.isError ? "—" : snapshot.finance.unknownPayment > 0 && snapshot.finance.paid + snapshot.finance.outstanding === 0 ? "Нет данных" : formatExecAmount(snapshot.finance.outstanding)}</strong>{snapshot.finance.unknownPayment > 0 && <small>Без {snapshot.finance.unknownPayment} заявок с неизвестной оплатой</small>}</a>
    <Link to={EXEC_LINKS.overdueDeliveries}><span>Задержки поставок</span><strong className="exec-warning">{metric(panel.overdueDeliveries)} <small>заявок</small></strong></Link>
    <Link to={EXEC_LINKS.overdueTasks}><span>Просроченные задачи</span><strong className="exec-danger">{metric(panel.overdueTasks)} <small>задач</small></strong></Link>
   </div></section>
   <div className="exec-primary">
    <section className="exec-surface"><SectionHead title={`Нужно решить${sourcesError || queueLoading ? "" : ` · ${snapshot.decisions.length}`}`} caption="Сначала срочное и просроченное" /><div className="exec-filters" role="group" aria-label="Фильтр решений">{FILTERS.map(f => <button key={f.key} aria-pressed={filter === f.key} className={filter === f.key ? "selected" : ""} onClick={() => { setFilter(f.key); setExpanded(false); }}>{f.label}<small>{queueLoading || sourcesError ? "—" : snapshot.decisions.filter(d => f.key === "all" || d.kinds.includes(f.key as Decision["kind"])).length}</small></button>)}</div>
     <LoadState loading={queueLoading} error={sourcesError} empty={!rows.length}>{rows.slice(0, expanded ? rows.length : 3).map(d => <article className="exec-decision" key={d.id}><div><span className={d.kind === "delivery" || d.kind === "task" ? "exec-danger" : "exec-warning"}>{filter === "payment" ? "Остаток к оплате" : d.reason}</span><h3>{decisionLink(d, d.title)}</h3><p>{d.meta}{filter === "payment" && d.kind !== "payment" && d.balance ? ` · ${money(d.balance)}` : ""}</p></div>{decisionLink(d, d.kind === "payment" ? "Счёт" : d.kind === "task" ? "Задача" : "Заявка", "exec-action")}</article>)}{rows.length > 3 && <button className="exec-section-link" onClick={() => setExpanded(v => !v)}>{expanded ? "Свернуть список" : `Показать все: ${rows.length}`}<ArrowRight size={15} /></button>}</LoadState>
    </section>
    <section className="exec-surface" id="exec-finance"><SectionHead title="Счета и оплата" caption="По открытым заявкам"><details className="exec-help"><summary aria-label="Как считаем оплату"><CircleHelp size={19} /></summary><p>Сумма счетов × фактически неоплаченная доля. План предоплаты не используется. Записи с неизвестным фактом оплаты исключены из остатка и отмечены ниже.</p></details></SectionHead>
     <LoadState loading={panel.requestAttention.isLoading} error={panel.requestAttention.isError}><div className="exec-money"><span>Осталось оплатить по известным отметкам</span><strong>{snapshot.finance.unknownPayment > 0 && snapshot.finance.paid + snapshot.finance.outstanding === 0 ? "Нет данных" : money(snapshot.finance.outstanding)}</strong></div><div className="exec-money-bar" role="img" aria-label={`По известным отметкам оплачено ${Math.round(percentPaid)}%`}><i style={{ width: `${percentPaid}%` }} /></div><div className="exec-key"><span>Отмечено оплачено</span><b>{money(snapshot.finance.paid)}</b></div><div className="exec-key"><span>Сумма всех счетов</span><b>{money(snapshot.finance.total)}</b></div><p className="exec-note">Оценка по данным CRM, без банковской сверки.{snapshot.finance.unknownPayment > 0 && <> Неизвестна оплата: {snapshot.finance.unknownPayment} заявок.</>}</p><button className="exec-payment-call" onClick={() => { setFilter("payment"); setExpanded(true); }}><span>Есть остаток к оплате<small>{snapshot.finance.payableRequests} заявок</small></span><ArrowRight size={17} /></button></LoadState>
    </section>
   </div>
   <section className="exec-surface"><SectionHead title="Ближайшие поставки" caption="План прихода · следующие 7 дней"><Link className="exec-text-link" to="/shipments">Все поставки <ArrowRight size={14} /></Link></SectionHead><LoadState loading={panel.requestAttention.isLoading} error={panel.requestAttention.isError} empty={!snapshot.upcoming.length}><div className="exec-deliveries">{snapshot.upcoming.slice(0, 3).map(r => <Link key={r.id} to={execRequestLink(r.id)} className="exec-delivery"><div className="exec-delivery-date">{format(parseISO(plannedArrival(r)!), "d MMMM", { locale: ru })}<span className={`exec-badge ${["В пути", "Отправлено", "Доставлено в ТК"].includes(r.status) ? "transit" : r.status.includes("Счёт") ? "invoice" : "new"}`}>{r.status}</span></div><h3>{r.description}</h3><p>{r.object?.name || "Без объекта"} · {r.transport_company || "ТК не указана"}</p><span>{r.executor || "Исполнитель не назначен"}</span></Link>)}</div></LoadState></section>
   <div className="exec-period-head"><SectionHead title="Результаты за период" caption="Завершение по фактической дате; текущая загрузка от периода не зависит" /><label>Период<select value={period} onChange={e => setPeriod(e.target.value)}><option value="year">Этот год</option><option value="month">Этот месяц</option><option value="week">Последние 7 дней</option><option value="quarter">Этот квартал</option></select></label></div>
   <section className="exec-surface"><SectionHead title="Работа команды" caption={`${format(from, "dd.MM.yyyy")} — ${format(now, "dd.MM.yyyy")}`} /><LoadState loading={queueLoading || events.completed.isLoading} error={sourcesError || events.completed.isError} empty={!team.length}><table className="exec-team"><thead><tr><th>Сотрудник</th><th>Заявок в работе</th><th>Сумма выполненных заявок</th><th>Поставок завершено</th><th>Выполнено</th></tr></thead><tbody>{team.map(m => { const total = m.completed + m.open; const percent = total ? Math.round(100 * m.completed / total) : 0; return <tr key={m.key}><td>{m.name}</td><td data-label="Заявок в работе">{m.open}</td><td data-label="Сумма выполненных заявок">{money(m.completedAmount)}</td><td data-label="Поставок завершено">{m.completed}</td><td data-label="Выполнено">{total ? `${percent}%` : "—"}<small>{total ? `Завершено: ${m.completed} из ${total}` : "Нет заявок"}</small></td></tr>; })}</tbody></table><p className="exec-note">Сумма выполненных заявок считается по завершённым поставкам за выбранный период.</p></LoadState></section>
   <div className="exec-secondary"><ExecObjectsLoad items={panel.objects.data ?? []} loading={panel.objects.isLoading} error={panel.objects.isError} />{canReadWarehouse && <section className="exec-surface"><SectionHead title="Склад" caption="Проведённые документы за выбранный период" /><LoadState loading={events.warehouse.isLoading} error={events.warehouse.isError}>{warehouseRows.map(r => <div className="exec-warehouse-row" key={r.label}><span>{r.label}</span><strong>{r.count}</strong></div>)}{otherDocs > 0 && <div className="exec-warehouse-row"><span>Другие документы</span><strong>{otherDocs}</strong></div>}<Link className="exec-section-link" to="/warehouse">Открыть склад <ArrowRight size={15} /></Link></LoadState></section>}</div>
   <section className="exec-quality"><SectionHead title="Проверить данные" caption="Пробелы, которые мешают точному анализу" /><LoadState loading={panel.requestAttention.isLoading} error={panel.requestAttention.isError}><div className="exec-quality-controls">{snapshot.quality.map(q => <button key={q.key} aria-expanded={quality === q.key} onClick={() => setQuality(v => v === q.key ? null : q.key)}>{q.label}<b>{q.rows.length}</b></button>)}</div>{selectedQuality && <div className="exec-quality-list"><h3>{selectedQuality.label}</h3>{selectedQuality.rows.length ? selectedQuality.rows.map(r => <Link key={r.id} to={execRequestLink(r.id)}>{r.description}<ArrowRight size={14} /></Link>) : <p>Все открытые заявки заполнены по этому признаку.</p>}</div>}</LoadState></section>
   <ExecRecentEvents items={panel.events.data ?? []} loading={panel.events.isLoading} error={panel.events.isError} onOpenTask={openTask} />
  </>}
  {task && <Suspense fallback={<p role="status">Открывается задача…</p>}><TaskDialog open task={task} onOpenChange={open => { if (!open) { setTask(null); void qc.invalidateQueries({ queryKey: ["executive", panel.orgId] }); } }} /></Suspense>}
 </div>;
}
