import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Clock,
  Loader2,
  Receipt,
  Sparkles,
  Truck,
  UserCheck,
  Wallet,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import {
  AnalyticsRequest,
  daysBetween,
  isOverdue,
  totalAmount,
  useAnalyticsRequests,
} from "@/hooks/useAnalyticsRequests";

const STALE_DAYS = 5;
const fmtMoneyPlain = (n: number) =>
  n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";

const DELIVERED = new Set(["Доставлено"]);
const CLOSED = new Set(["Отменено", "Отклонено", "Закрыто", "Архив"]);
const ACCOUNTING_STATUSES = new Set(["Счёт в бухгалтерии", "Счёт в Бухгалтерии"]);
const EMERGENCY_PRIORITIES = new Set(["Аварийная", "Аварийный", "Авария"]);
const REVIEW_STATUSES = new Set(["На согласовании", "На доработке", "Ожидает решения"]);

const TODAY = startOfDay(new Date());
const TODAY_ISO = format(TODAY, "yyyy-MM-dd");

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isOpen(r: AnalyticsRequest) {
  return !r.archived && !DELIVERED.has(r.status ?? "") && !CLOSED.has(r.status ?? "");
}

function isEmergency(r: AnalyticsRequest) {
  const p = (r.priority ?? "").toLowerCase();
  return p.includes("авар");
}

function ageDays(r: AnalyticsRequest) {
  return daysBetween(r.updated_at, new Date().toISOString()) ?? 0;
}

function sameDay(iso: string | null | undefined, ref: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isWithinNextDays(iso: string | null | undefined, n: number) {
  if (!iso) return false;
  const d = new Date(iso).getTime();
  const now = Date.now();
  return d >= now && d <= now + n * 86400000;
}

function fmtMoney(n: number) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";
}

type ListItem = {
  request: AnalyticsRequest;
  meta?: string;
  rightMeta?: string;
};

function RequestListCard({
  title,
  description,
  icon: Icon,
  tone = "default",
  items,
  empty = "Нет заявок",
  cap = 25,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "danger" | "success";
  items: ListItem[];
  empty?: string;
  cap?: number;
}) {
  const toneClasses = {
    default: "text-primary",
    warning: "text-amber-500",
    danger: "text-red-500",
    success: "text-emerald-500",
  }[tone];

  return (
    <Card className="p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${toneClasses}`} />
          <div>
            <div className="font-semibold text-sm">{title}</div>
            {description && (
              <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
            )}
          </div>
        </div>
        <Badge variant={items.length > 0 ? "secondary" : "outline"} className="font-numeric">
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">{empty}</div>
      ) : (
        <ScrollArea className="max-h-64 pr-2 -mr-2">
          <ul className="space-y-1.5">
            {items.slice(0, cap).map(({ request: r, meta, rightMeta }) => (
              <li key={r.id}>
                <Link
                  to={`/requests/${r.id}`}
                  className="block rounded-md border border-border/60 hover:border-primary/40 hover:bg-accent/40 px-2.5 py-2 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">
                      {r.description || r.request_number || "Без названия"}
                    </div>
                    {rightMeta && (
                      <div className="text-xs font-numeric text-muted-foreground whitespace-nowrap">
                        {rightMeta}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="text-[11px] text-muted-foreground truncate">
                      {[r.contractor, r.status].filter(Boolean).join(" • ")}
                    </div>
                    {meta && (
                      <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {meta}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
            {items.length > cap && (
              <li className="text-[11px] text-muted-foreground px-1 py-1">
                …и ещё {items.length - cap}
              </li>
            )}
          </ul>
        </ScrollArea>
      )}
    </Card>
  );
}

function SectionHeader({
  index,
  title,
  hint,
}: {
  index: number;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-3 mt-2">
      <div className="text-xs font-numeric text-muted-foreground tabular-nums w-5">
        {String(index).padStart(2, "0")}
      </div>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

export default function AnalyticsDayPrepPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const { data: requests, loading } = useAnalyticsRequests();
  const [myName, setMyName] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [objectMap, setObjectMap] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!cancel) setMyName(p?.full_name ?? null);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!currentOrgId) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("request_objects")
        .select("id,name")
        .eq("organization_id", currentOrgId);
      if (cancel || !data) return;
      const map: Record<string, string> = {};
      for (const o of data as { id: string; name: string }[]) map[o.id] = o.name;
      setObjectMap(map);
    })();
    return () => {
      cancel = true;
    };
  }, [currentOrgId]);

  const open = useMemo(() => requests.filter(isOpen), [requests]);

  // Identify "me" — heuristic: profile.full_name matches executor OR contains key surname
  const isMine = (r: AnalyticsRequest) => {
    const ex = (r.executor ?? "").trim();
    if (!ex) return false;
    if (myName && ex.toLowerCase() === myName.toLowerCase()) return true;
    // Manager fallback — Никулин is the owner
    return ex.toLowerCase().includes("никулин");
  };

  const isKazakova = (r: AnalyticsRequest) =>
    (r.executor ?? "").toLowerCase().includes("казак");

  // 1. Мои задачи на сегодня
  const myEmergency = open.filter((r) => isEmergency(r) && isMine(r));
  const needsExecutor = open.filter((r) => !r.executor);
  const myOverdue = open.filter((r) => isOverdue(r) && isMine(r));
  const myAccounting = open.filter((r) => isMine(r) && ACCOUNTING_STATUSES.has(r.status ?? ""));
  const myReview = open.filter(
    (r) => isMine(r) && REVIEW_STATUSES.has(r.status ?? ""),
  );
  const noSupplier = open.filter((r) => !r.contractor);
  const noDeliveryDate = open.filter(
    (r) => !r.delivery_date && !r.planned_delivery_date,
  );

  const myTasks: Array<{
    key: string;
    title: string;
    items: AnalyticsRequest[];
    tone?: "danger" | "warning" | "default";
  }> = [
    { key: "em", title: "Согласовать аварийные заявки", items: myEmergency, tone: "danger" },
    { key: "ex", title: "Назначить исполнителя", items: needsExecutor, tone: "warning" },
    { key: "ov", title: "Проверить просроченные заявки", items: myOverdue, tone: "danger" },
    { key: "ac", title: "Согласовать счета", items: myAccounting },
    { key: "rv", title: "Принять решение по проблемным заявкам", items: myReview, tone: "warning" },
    { key: "sp", title: "Проверить заявки без поставщика", items: noSupplier },
    { key: "dd", title: "Проверить заявки без срока поставки", items: noDeliveryDate },
  ];

  // 2. Где застряли
  const stuckAccounting = open
    .filter((r) => ACCOUNTING_STATUSES.has(r.status ?? ""))
    .map((r) => ({
      request: r,
      meta: `${daysBetween(r.updated_at, new Date().toISOString()) ?? 0} дн.`,
      rightMeta:
        totalAmount(r) > 0
          ? `${r.invoice_number ? "№ " + r.invoice_number + " · " : ""}${fmtMoney(totalAmount(r))}`
          : undefined,
    }))
    .sort((a, b) => ageDays(b.request) - ageDays(a.request));

  const procurementNeeds = [
    { label: "без поставщика", items: open.filter((r) => !r.contractor) },
    { label: "без счёта", items: open.filter((r) => !r.invoice_number && totalAmount(r) === 0) },
    { label: "без даты отгрузки", items: open.filter((r) => !r.shipment_date) },
    { label: "без транспортной компании", items: open.filter((r) => !r.transport_company) },
    {
      label: "без срока поставки",
      items: open.filter((r) => !r.delivery_date && !r.planned_delivery_date),
    },
    {
      label: "без движения > 5 дней",
      items: open.filter((r) => ageDays(r) > 5),
    },
  ];

  const overdueList = open
    .filter(isOverdue)
    .map((r) => {
      const target = r.delivery_date ?? r.planned_delivery_date;
      const days = target
        ? Math.round((Date.now() - new Date(target).getTime()) / 86400000)
        : 0;
      return { request: r, rightMeta: `+${days} дн.` as string, _days: days };
    })
    .sort((a, b) => b._days - a._days);

  // 3. Передать Казаковой
  const kazNoInvoice = open.filter((r) => isKazakova(r) && !r.invoice_number);
  const kazNeedPay = open.filter(
    (r) =>
      isKazakova(r) &&
      r.payment_status &&
      r.payment_status.toLowerCase().includes("ожид"),
  );
  const kazNoPayMark = open.filter(
    (r) => isKazakova(r) && !r.payment_status && totalAmount(r) > 0,
  );
  const kazShipReady = open.filter(
    (r) => isKazakova(r) && !r.shipment_date && r.transport_company,
  );

  const kazSections: ListItem[][] = [
    kazNoInvoice.map((r) => ({ request: r, meta: "нет счёта", rightMeta: `${ageDays(r)} дн.` })),
    kazNeedPay.map((r) => ({
      request: r,
      meta: "к оплате",
      rightMeta: fmtMoney(totalAmount(r)),
    })),
    kazNoPayMark.map((r) => ({
      request: r,
      meta: "нет отметки об оплате",
      rightMeta: fmtMoney(totalAmount(r)),
    })),
    kazShipReady.map((r) => ({
      request: r,
      meta: "оформить отгрузку",
      rightMeta: `${ageDays(r)} дн.`,
    })),
  ];

  // 4. Требует решения руководителя
  const stalledEmergency = open.filter((r) => isEmergency(r) && ageDays(r) > 1);
  const bigAmount = open
    .filter((r) => totalAmount(r) >= 300000 && REVIEW_STATUSES.has(r.status ?? ""))
    .sort((a, b) => totalAmount(b) - totalAmount(a));
  const noExecForManager = open.filter((r) => !r.executor && ageDays(r) > 0);
  const longOverdue = open.filter(
    (r) => isOverdue(r) && ageDays(r) > 3,
  );
  const awaitingApproval = open.filter((r) => REVIEW_STATUSES.has(r.status ?? ""));

  // 5. Контроль сроков
  const payToday = open.filter(
    (r) =>
      r.payment_status &&
      r.payment_status.toLowerCase().includes("ожид") &&
      sameDay(r.invoice_date, TODAY),
  );
  const shipToday = open.filter((r) => sameDay(r.shipment_date, TODAY));
  const arriveToday = open.filter(
    (r) => sameDay(r.delivery_date, TODAY) || sameDay(r.planned_delivery_date, TODAY),
  );
  const soonBreak = open
    .filter(
      (r) =>
        isWithinNextDays(r.delivery_date, 3) ||
        isWithinNextDays(r.planned_delivery_date, 3),
    )
    .map((r) => {
      const t = r.delivery_date ?? r.planned_delivery_date!;
      return {
        request: r,
        rightMeta: format(new Date(t), "d MMM", { locale: ru }),
      };
    });

  // 6. AI рекомендации
  const buildSnapshot = () => ({
    today: TODAY_ISO,
    manager: myName ?? "Никулин Е.В.",
    totals: {
      open: open.length,
      emergency: open.filter(isEmergency).length,
      overdue: open.filter(isOverdue).length,
      no_executor: needsExecutor.length,
      no_supplier: noSupplier.length,
      accounting: stuckAccounting.length,
    },
    my_tasks: myTasks.map((t) => ({ title: t.title, count: t.items.length })),
    stuck: {
      accounting_top: stuckAccounting.slice(0, 5).map((x) => ({
        id: x.request.id,
        description: x.request.description,
        contractor: x.request.contractor,
        invoice: x.request.invoice_number,
        amount: totalAmount(x.request),
        waiting_days: ageDays(x.request),
      })),
      procurement_needs: procurementNeeds.map((p) => ({ label: p.label, count: p.items.length })),
      overdue_top: overdueList.slice(0, 5).map((x) => ({
        id: x.request.id,
        description: x.request.description,
        executor: x.request.executor,
        overdue_days: x._days,
      })),
    },
    kazakova: {
      no_invoice: kazNoInvoice.length,
      need_pay: kazNeedPay.length,
      no_pay_mark: kazNoPayMark.length,
      ship_ready: kazShipReady.length,
    },
    decisions: {
      stalled_emergency: stalledEmergency.length,
      big_amount: bigAmount.length,
      no_executor: noExecForManager.length,
      long_overdue: longOverdue.length,
      awaiting_approval: awaitingApproval.length,
    },
    deadlines: {
      pay_today: payToday.length,
      ship_today: shipToday.length,
      arrive_today: arriveToday.length,
      due_in_3_days: soonBreak.length,
    },
  });

  const generateAi = async () => {
    if (!currentOrgId) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analytics-day-prep", {
        body: { organization_id: currentOrgId, snapshot: buildSnapshot() },
      });
      if (error) throw error;
      setAiContent(data?.content ?? null);
    } catch (e: any) {
      const msg = e?.message ?? "Ошибка";
      toast({
        title: "Ошибка",
        description: msg.includes("402")
          ? "Закончились кредиты Lovable AI. Пополните баланс."
          : msg.includes("429")
            ? "Слишком много запросов. Попробуйте позже."
            : msg,
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Подготовка к дню
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(TODAY, "EEEE, d MMMM yyyy", { locale: ru })}
            {myName ? ` · ${myName}` : ""}
          </p>
        </div>
        <Button onClick={generateAi} disabled={aiLoading} className="gap-2">
          {aiLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Сформировать AI-резюме дня
        </Button>
      </div>

      {/* 1. Мои задачи */}
      <SectionHeader index={1} title="Мои задачи на сегодня" hint="Сформировано автоматически по данным CRM" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {myTasks.map((t) => (
          <RequestListCard
            key={t.key}
            title={t.title}
            icon={
              t.tone === "danger"
                ? AlertTriangle
                : t.tone === "warning"
                  ? Clock
                  : ClipboardList
            }
            tone={t.tone ?? "default"}
            items={t.items.map((r) => ({
              request: r,
              rightMeta:
                totalAmount(r) > 0 ? fmtMoney(totalAmount(r)) : undefined,
              meta: r.executor ?? "без исполнителя",
            }))}
            empty="Сегодня ничего не требуется"
          />
        ))}
      </div>

      {/* 2. Где застряли */}
      <SectionHeader index={2} title="Где сейчас застряли заявки" />
      <div className="grid gap-4 lg:grid-cols-2">
        <RequestListCard
          title="Ожидают бухгалтерию"
          description="Статус «Счёт в бухгалтерии», по времени ожидания"
          icon={Wallet}
          tone="warning"
          items={stuckAccounting}
          empty="В бухгалтерии нет зависших счетов"
          cap={50}
        />
        <RequestListCard
          title="Просроченные заявки"
          description="Сортировка по дням просрочки"
          icon={AlertTriangle}
          tone="danger"
          items={overdueList}
          empty="Нет просроченных заявок"
          cap={50}
        />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-5 w-5 text-primary" />
          <div className="font-semibold text-sm">Требуют действий отдела закупок</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {procurementNeeds.map((p) => (
            <Link
              key={p.label}
              to={`/requests`}
              className="rounded-md border border-border/60 hover:border-primary/40 hover:bg-accent/40 p-3 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm capitalize">{p.label}</span>
                <Badge variant={p.items.length > 0 ? "secondary" : "outline"} className="font-numeric">
                  {p.items.length}
                </Badge>
              </div>
              {p.items.length > 0 && (
                <div className="mt-2 space-y-1">
                  {p.items.slice(0, 3).map((r) => (
                    <Link
                      key={r.id}
                      to={`/requests/${r.id}`}
                      className="block text-xs text-muted-foreground hover:text-foreground truncate"
                    >
                      • {r.description || r.request_number}
                    </Link>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </Card>

      {/* 3. Казакова */}
      <SectionHeader index={3} title="Что необходимо передать Казаковой" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <RequestListCard
          title="Отсутствует счёт"
          icon={Receipt}
          items={kazSections[0]}
          empty="Всё в порядке"
        />
        <RequestListCard
          title="Необходимо оплатить"
          icon={Wallet}
          items={kazSections[1]}
          empty="Нет ожидающих оплаты"
        />
        <RequestListCard
          title="Нет отметки об оплате"
          icon={Wallet}
          tone="warning"
          items={kazSections[2]}
          empty="Все оплаты отмечены"
        />
        <RequestListCard
          title="Оформить отгрузку"
          icon={Truck}
          items={kazSections[3]}
          empty="Нет ожидающих отгрузки"
        />
      </div>

      {/* 4. Требует решения руководителя */}
      <SectionHeader index={4} title="Что требует моего решения" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <RequestListCard
          title="Аварийные без движения"
          icon={AlertTriangle}
          tone="danger"
          items={stalledEmergency.map((r) => ({
            request: r,
            rightMeta: `${ageDays(r)} дн.`,
          }))}
          empty="Нет"
        />
        <RequestListCard
          title="Крупные суммы на согласовании"
          icon={Wallet}
          tone="warning"
          items={bigAmount.map((r) => ({
            request: r,
            rightMeta: fmtMoney(totalAmount(r)),
          }))}
          empty="Нет"
        />
        <RequestListCard
          title="Без исполнителя"
          icon={UserCheck}
          tone="warning"
          items={noExecForManager.map((r) => ({
            request: r,
            rightMeta: `${ageDays(r)} дн.`,
          }))}
          empty="Все заявки распределены"
        />
        <RequestListCard
          title="Просрочка > 3 дней"
          icon={AlertTriangle}
          tone="danger"
          items={longOverdue.map((r) => ({
            request: r,
            meta: r.executor ?? "—",
          }))}
          empty="Нет"
        />
        <RequestListCard
          title="Ожидают согласования"
          icon={ClipboardList}
          items={awaitingApproval.map((r) => ({
            request: r,
            rightMeta: `${ageDays(r)} дн.`,
          }))}
          empty="Нет"
        />
      </div>

      {/* 5. Контроль сроков */}
      <SectionHeader index={5} title="Контроль сроков" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <RequestListCard
          title="Оплатить сегодня"
          icon={Wallet}
          tone="warning"
          items={payToday.map((r) => ({
            request: r,
            rightMeta: fmtMoney(totalAmount(r)),
          }))}
          empty="Нет платежей на сегодня"
        />
        <RequestListCard
          title="Отгрузить сегодня"
          icon={Truck}
          items={shipToday.map((r) => ({ request: r }))}
          empty="Нет отгрузок"
        />
        <RequestListCard
          title="Прибудет сегодня"
          icon={Calendar}
          tone="success"
          items={arriveToday.map((r) => ({ request: r }))}
          empty="Нет ожидаемых прибытий"
        />
        <RequestListCard
          title="Сроки в ближайшие 3 дня"
          icon={Clock}
          items={soonBreak}
          empty="Свободно"
        />
      </div>

      {/* 6. AI */}
      <SectionHeader index={6} title="AI-рекомендации" />
      <Card className="p-5">
        {!aiContent && !aiLoading && (
          <div className="text-sm text-muted-foreground">
            Нажмите «Сформировать AI-резюме дня», чтобы получить краткий брифинг руководителя на сегодня.
          </div>
        )}
        {aiLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> AI анализирует данные…
          </div>
        )}
        {aiContent && (
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{aiContent}</ReactMarkdown>
          </article>
        )}
      </Card>
    </div>
  );
}
