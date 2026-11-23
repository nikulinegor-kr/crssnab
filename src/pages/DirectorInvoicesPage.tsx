import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { getRequestFileUrls, requestFileName } from "@/lib/requestDocuments";
import { selectRequestInvoiceUrl } from "@/lib/requestInvoiceMax";
import { resolveSignedUrl } from "@/lib/storageUrl";
import { APPROVAL_STATUSES, directorPreferenceKey } from "@/lib/directorInvoice";
import { directorLandingKey } from "@/lib/authNavigation";
import { formatExecFullAmount } from "@/lib/executivePanel";

type Action = "pay" | "service" | "rework";
type Widget = "overdue" | "urgent" | "tasks" | "recent";
const WIDGETS: { id: Widget; label: string }[] = [
  { id: "overdue", label: "Просроченные поставки" },
  { id: "urgent", label: "Аварийные заявки" },
  { id: "tasks", label: "Мои задачи" },
  { id: "recent", label: "Последние решения" },
];
const LABELS: Record<Action, string> = { pay: "В оплату", service: "В ТО", rework: "На доработку" };
const money = (amount: number | null) => amount == null ? "Не указана" : formatExecFullAmount(amount);
const paymentClass = "bg-emerald-700 text-white hover:bg-emerald-800";
type Row = { id: string; title: string; link?: string };

export default function DirectorInvoicesPage() {
  const { currentOrgId: org } = useCurrentOrganization();
  const client = useQueryClient();
  const [selected, setSelected] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [landing, setLanding] = useState(false);
  const [preferences, setPreferences] = useState<Widget[]>([]);
  const [preferLanding, setPreferLanding] = useState(false);
  const session = useQuery({ queryKey: ["director-user"], queryFn: async () => (await supabase.auth.getUser()).data.user });
  const userId = session.data?.id;
  const access = useQuery({
    queryKey: ["director-access", org, userId],
    enabled: Boolean(org && userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_approve_crss_invoices", { org_id: org! });
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!userId || !org) return;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(directorPreferenceKey(userId, org)) ?? "[]");
      setWidgets(Array.isArray(stored) ? WIDGETS.filter(w => stored.includes(w.id)).map(w => w.id) : []);
      setLanding(localStorage.getItem(directorLandingKey(userId, org)) === "true");
    } catch { setWidgets([]); setLanding(false); }
    setSelected("");
    setMobileOpen(false);
  }, [org, userId]);

  const queue = useQuery({
    queryKey: ["director-invoices", org, userId],
    enabled: access.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("requests")
        .select("id,description,applicant,applicant_justification,contractor,amount,invoice_number,invoice_date,payment_percentage,document_url,document_urls,status,objects(name)")
        .eq("organization_id", org!).in("status", APPROVAL_STATUSES).is("invoice_routing", null)
        .order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const current = queue.data?.find(item => item.id === selected) ?? queue.data?.[0];
  const document = current ? selectRequestInvoiceUrl(getRequestFileUrls(current, "document")) : null;
  const preview = useQuery({
    queryKey: ["director-invoice-preview", document, userId, org],
    enabled: Boolean(document && access.data),
    queryFn: () => resolveSignedUrl(document!, 300, true),
  });

  const widgetData = useQuery({
    queryKey: ["director-widgets", org, userId, widgets],
    enabled: access.data === true && widgets.length > 0,
    queryFn: async () => {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Novosibirsk" });
      const data: Partial<Record<Widget, Row[]>> = {};
      await Promise.all(widgets.map(async widget => {
        if (widget === "recent") {
          const result = await supabase.from("director_invoice_decisions").select("id,request_id,action,signer_name,requests(description)")
            .eq("organization_id", org!).order("decided_at", { ascending: false }).limit(6);
          if (result.error) throw result.error;
          data.recent = result.data.map(row => ({ id: row.id, title: `${LABELS[row.action as Action]} · ${row.requests?.description || "Счёт"} · ${row.signer_name}`, link: `/requests?request=${row.request_id}` }));
        } else if (widget === "tasks") {
          const result = await supabase.from("planner_tasks").select("id,title").eq("organization_id", org!)
            .eq("assignee_id", userId!).is("archived_at", null).not("status", "in", "(done,cancelled)")
            .order("due_date").limit(6);
          if (result.error) throw result.error;
          data.tasks = result.data.map(row => ({ id: row.id, title: row.title, link: `/tasks?task=${row.id}` }));
        } else {
          const query = supabase.from("requests").select("id,description").eq("organization_id", org!)
            .is("actual_arrival_date", null).neq("status", "Доставлено");
          const result = await (widget === "overdue" ? query.lt("delivery_date", today).order("delivery_date") : query.eq("priority", "Аварийно").order("created_at", { ascending: false })).limit(6);
          if (result.error) throw result.error;
          data[widget] = result.data.map(row => ({ id: row.id, title: row.description, link: `/requests?request=${row.id}` }));
        }
      }));
      return data;
    },
  });

  async function submit() {
    if (!action || !current || busy || (action === "rework" && !comment.trim())) return;
    setBusy(true);
    try {
      let path: string | null = null;
      if (action === "pay") {
        if (!document || !/[-_.]zrs\.pdf$/i.test(requestFileName(document))) throw new Error("Сначала прикрепите счёт с ЗРС");
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) throw new Error("Войдите снова");
        const { data: profile, error } = await supabase.from("profiles").select("full_name").eq("id", user.user.id).single();
        const signer = profile?.full_name?.trim();
        if (error || !signer) throw new Error("Заполните ФИО в профиле");
        const url = await resolveSignedUrl(document, 120, true);
        const [invoice, font] = await Promise.all([fetch(url), fetch("/fonts/Roboto-Regular.ttf")]);
        if (!invoice.ok || !font.ok) throw new Error("Не удалось открыть счёт для резолюции");
        const { stampDirectorInvoice } = await import("@/lib/directorInvoice");
        const bytes = await stampDirectorInvoice(await invoice.arrayBuffer(), await font.arrayBuffer(), signer, new Date().toLocaleDateString("ru-RU", { timeZone: "Asia/Novosibirsk" }));
        path = `${current.id}/approval-${crypto.randomUUID()}-ZRS.pdf`;
        const uploaded = await supabase.storage.from("request-documents").upload(path, bytes, { contentType: "application/pdf" });
        if (uploaded.error) throw uploaded.error;
      }
      const response = await supabase.rpc("decide_crss_invoice", {
        request_key: current.id, decision: action, source_document: document,
        stamped_path: path, revision_comment: action === "rework" ? comment.trim() : null,
      });
      if (response.error) throw response.error;
      toast.success("Решение сохранено. Отправка в MAX поставлена в очередь.");
      setAction(null);
      setMobileOpen(false);
      void client.invalidateQueries({ queryKey: ["director-invoices", org] });
      void client.invalidateQueries({ queryKey: ["director-widgets", org] });
      void client.invalidateQueries({ queryKey: ["requests"] });
    } catch (error) {
      toast.error(error && typeof error === "object" && "message" in error ? String(error.message) : "Не удалось сохранить решение");
    } finally { setBusy(false); }
  }

  if (!org) return <Navigate to="/select-organization?next=/director" replace />;
  if (access.isError) return <p className="p-6" role="alert">Не удалось проверить доступ.</p>;
  if (access.data === false) return <Navigate to="/requests" replace />;
  if (!access.data) return <p className="p-6" role="status">Проверяем доступ…</p>;

  return (
    <main className="mx-auto grid w-full max-w-[1420px] gap-5 px-4 py-6 lg:px-8">
      <header className={`flex flex-wrap items-start justify-between gap-3 ${mobileOpen ? "hidden md:flex" : ""}`}>
        <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Счета на согласование</h1><p className="mt-1 text-muted-foreground">Заявки со статусом «Счёт на оплату»</p></div>
        <Button variant="outline" onClick={() => { setPreferences(widgets); setPreferLanding(landing); setSettings(true); }}>Настроить страницу</Button>
      </header>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(230px,0.7fr)_minmax(0,1.5fr)]">
        <section className={`min-w-0 rounded-xl border bg-card ${mobileOpen ? "hidden md:block" : ""}`}>
          <header className="flex justify-between border-b px-4 py-3 font-semibold"><h2>Ожидают решения</h2><span>{queue.data?.length ?? "—"}</span></header>
          {queue.isLoading ? <p className="p-4">Загружаем счета…</p> : queue.isError ? <p className="p-4" role="alert">Не удалось загрузить счета.</p> : !queue.data?.length ? <p className="p-4 text-muted-foreground">На согласовании пока нет счетов.</p> : (
            <ul className="space-y-1 p-2">{queue.data.map(row => <li key={row.id}>
              <button type="button" aria-current={row.id === current?.id} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-3 py-3 text-left hover:bg-muted ${row.id === current?.id ? "bg-primary/10" : ""}`} onClick={() => { setSelected(row.id); setMobileOpen(true); }}>
                <span className="min-w-0 break-words"><strong className="block">{row.description}</strong><small className="text-muted-foreground">{row.contractor || "Контрагент не указан"}</small></span>
                <strong className="tabular-nums">{money(row.amount)}</strong>
              </button>
            </li>)}</ul>
          )}
        </section>
        {current && <div className={mobileOpen ? "" : "hidden md:block"}>
          <Button variant="outline" className="mb-3 md:hidden" onClick={() => setMobileOpen(false)}>К списку</Button>
          <article className="flex min-w-0 flex-col rounded-xl border bg-card">
            <header className="px-4 py-4 sm:px-6"><h2 className="break-words text-xl font-semibold">{current.description}</h2><Link className="text-sm text-primary underline-offset-4 hover:underline" to={`/requests?request=${current.id}`}>Открыть заявку</Link></header>
            <dl className="mx-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y py-4 sm:mx-6 lg:grid-cols-3">
              {[["Контрагент", current.contractor], ["Сумма счёта", money(current.amount)], ["Номер и дата счёта", [current.invoice_number, current.invoice_date].filter(Boolean).join(" · ")], ["Объект", current.objects?.name], ["Заявитель", current.applicant], ["Предоплата", current.payment_percentage == null ? null : `${current.payment_percentage}%`]].map(([label,value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value || "Не указано"}</dd></div>)}
            </dl>
            <section className="mx-4 border-b py-3 sm:mx-6"><h3 className="font-semibold">Обоснование заявителя</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{current.applicant_justification || "Не указано"}</p></section>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
              <span className="min-w-0 break-all text-sm font-medium">{document ? requestFileName(document) : "Счёт не прикреплён"}</span>
              {preview.data && <Button variant="outline" asChild><a target="_blank" rel="noopener" href={preview.data}>Открыть счёт</a></Button>}
              {preview.isError && <p className="text-sm text-destructive">Нет доступа к файлу счёта.</p>}
            </div>
            <div className="sticky bottom-0 z-10 order-last flex flex-wrap items-center gap-2 rounded-b-xl border-t bg-card px-4 py-3 md:static md:order-none md:rounded-none sm:px-6">
              <Button variant="outline" onClick={() => { setComment(""); setAction("rework"); }}>На доработку</Button>
              <Button variant="outline" disabled={!preview.data} onClick={() => setAction("service")}>В ТО</Button>
              <Button className={`ml-auto ${paymentClass}`} disabled={!preview.data} onClick={() => setAction("pay")}>В оплату</Button>
            </div>
            {preview.data && <iframe className="mx-4 mb-4 h-[520px] w-[calc(100%-2rem)] rounded-lg border bg-muted sm:mx-6 sm:w-[calc(100%-3rem)]" src={preview.data} title="Предпросмотр счёта" />}
          </article>
        </div>}
      </div>
      {!!widgets.length && <div className={`grid gap-4 sm:grid-cols-2 ${mobileOpen ? "hidden md:grid" : ""}`}>{WIDGETS.filter(widget => widgets.includes(widget.id)).map(widget => <section key={widget.id} className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">{widget.label}</h2>
        {widgetData.isError ? <p className="mt-2 text-destructive">Не удалось загрузить данные.</p> : widgetData.isLoading ? <p className="mt-2 text-muted-foreground">Загрузка…</p> : widgetData.data?.[widget.id]?.length
          ? <ul className="mt-2 divide-y">{widgetData.data[widget.id]!.map(row => <li key={row.id} className="py-2"><Link className="hover:underline" to={row.link!}>{row.title}</Link></li>)}</ul>
          : <p className="mt-2 text-muted-foreground">Пока нет записей.</p>}
      </section>)}</div>}
      <Dialog open={action !== null} onOpenChange={open => { if (!open && !busy) setAction(null); }}>
        <DialogContent><DialogHeader><DialogTitle>{action === "pay" ? "Точно отправить счёт в оплату?" : action === "service" ? "Направить счёт в ТО?" : "Вернуть на доработку"}</DialogTitle>
          <DialogDescription>{action === "rework" ? "Комментарий получит группа «Поставка ТМЦ»." : `${current?.contractor || "Счёт"} · ${money(current?.amount ?? null)}. Получатель в MAX — «СахаРесурс | Счета на оплату».`}</DialogDescription></DialogHeader>
          {action === "rework" && <label className="grid gap-2 text-sm font-medium">Что нужно скорректировать<Textarea value={comment} maxLength={1000} onChange={event => setComment(event.target.value)} disabled={busy} /></label>}
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Отмена</Button>
            <Button className={action === "pay" ? paymentClass : undefined} onClick={() => void submit()} disabled={busy || (action === "rework" && !comment.trim())}>{busy ? "Сохраняем…" : action === "pay" ? "Подтвердить оплату" : action === "service" ? "Отправить в ТО" : "Вернуть на доработку"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent><DialogHeader><DialogTitle>Настроить страницу</DialogTitle><DialogDescription>Счета на согласование видны всегда.</DialogDescription></DialogHeader>
          <fieldset className="grid divide-y">{WIDGETS.map(widget => <label key={widget.id} className="flex min-h-11 items-center justify-between gap-4">{widget.label}<input aria-label={widget.label} className="size-5 accent-primary" type="checkbox" checked={preferences.includes(widget.id)} onChange={event => setPreferences(current => event.target.checked ? [...current, widget.id] : current.filter(key => key !== widget.id))} /></label>)}
            <label className="flex min-h-11 items-center justify-between gap-4">Открывать после входа<input className="size-5 accent-primary" type="checkbox" checked={preferLanding} onChange={event => setPreferLanding(event.target.checked)} /></label></fieldset>
          <DialogFooter><Button variant="outline" onClick={() => setSettings(false)}>Отмена</Button><Button onClick={() => {
            if (!userId || !org) return;
            localStorage.setItem(directorPreferenceKey(userId, org), JSON.stringify(preferences));
            localStorage.setItem(directorLandingKey(userId, org), String(preferLanding));
            setWidgets(preferences); setLanding(preferLanding); setSettings(false);
          }}>Сохранить настройки</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
