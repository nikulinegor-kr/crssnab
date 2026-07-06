import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Loader2,
  Receipt,
  RefreshCw,
  Save,
  Sparkles,
  Truck,
  UserX,
  Wallet,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AnalyticsRequest,
  daysBetween,
  isOverdue,
  totalAmount,
} from "@/hooks/useAnalyticsRequests";

const ACCOUNTING_STATUSES = new Set([
  "Счёт в бухгалтерии",
  "Счёт в Бухгалтерии",
]);
const DELIVERED = new Set(["Доставлено"]);
const CLOSED = new Set(["Отменено", "Отклонено", "Закрыто", "Архив"]);
const STALE_DAYS = 5;

const fmtMoney = (n: number) =>
  n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";

const isOpen = (r: AnalyticsRequest) =>
  !r.archived && !DELIVERED.has(r.status ?? "") && !CLOSED.has(r.status ?? "");
const isEmergency = (r: AnalyticsRequest) =>
  (r.priority ?? "").toLowerCase().includes("авар");
const ageDays = (r: AnalyticsRequest) =>
  daysBetween(r.updated_at, new Date().toISOString()) ?? 0;

const sameDay = (iso: string | null | undefined, ref: Date) => {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
};

// ---------- Types ----------

type BucketKey =
  | "emergency"
  | "overdue"
  | "accounting"
  | "stalled"
  | "arrive_today"
  | "no_supplier";

type BucketRow = {
  id: string;
  request_number?: string | number | null;
  description: string;
  object: string | null;
  executor: string | null;
  reason: string;
  days: number | null;
  amount: number | null;
};

type BucketMeta = {
  key: BucketKey;
  label: string;
  icon: keyof typeof ICONS;
  tone: "default" | "warning" | "danger" | "success";
  showAmount: boolean;
};

type SnapshotSummary = {
  emergency_total: number;
  emergency_new_today: number;
  overdue_total: number;
  overdue_max_days: number;
  accounting_total: number;
  accounting_amount: number;
  accounting_avg_days: number;
  accounting_over_week: number;
  stalled_total: number;
  arrive_today_total: number;
  arrive_today_new_emergency: number;
  no_supplier_total: number;
};

type BriefSnapshot = {
  summary: SnapshotSummary;
  buckets: Record<BucketKey, BucketRow[]>;
};

type SavedBrief = {
  id: string;
  brief_date: string;
  generated_at: string;
  created_by_name: string | null;
  narrative: string | null;
  metrics: SnapshotSummary;
  buckets: Record<BucketKey, BucketRow[]>;
};

const ICONS = {
  AlertTriangle,
  Clock,
  Wallet,
  Truck,
  UserX,
  Receipt,
} as const;

const BUCKET_META: BucketMeta[] = [
  { key: "emergency", label: "Аварийные заявки", icon: "AlertTriangle", tone: "danger", showAmount: false },
  { key: "overdue", label: "Просроченные заявки", icon: "AlertTriangle", tone: "danger", showAmount: false },
  { key: "accounting", label: "Счета в бухгалтерии", icon: "Wallet", tone: "warning", showAmount: true },
  { key: "stalled", label: `Без движения более ${STALE_DAYS} дней`, icon: "Clock", tone: "warning", showAmount: false },
  { key: "arrive_today", label: "Поступления сегодня", icon: "Truck", tone: "success", showAmount: false },
  { key: "no_supplier", label: "Без поставщика", icon: "UserX", tone: "warning", showAmount: false },
];

const toneClass = (t: BucketMeta["tone"]) =>
  ({
    default: "text-primary",
    warning: "text-amber-500",
    danger: "text-red-500",
    success: "text-emerald-500",
  })[t];

// ---------- Snapshot builder ----------

export function buildBriefSnapshot(
  requests: AnalyticsRequest[],
  objectMap: Record<string, string>,
): BriefSnapshot {
  const open = requests.filter(isOpen);
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const objOf = (r: AnalyticsRequest) =>
    (r.object_id && objectMap[r.object_id]) || null;

  const rowBase = (r: AnalyticsRequest, reason: string, days: number | null): BucketRow => ({
    id: r.id,
    request_number: r.request_number ?? null,
    description: r.description || "Без названия",
    object: objOf(r),
    executor: r.executor ?? null,
    reason,
    days,
    amount: totalAmount(r) || null,
  });

  // Emergency
  const emergencyList = open.filter(isEmergency);
  const emergencyNewToday = emergencyList.filter((r) =>
    sameDay(r.created_at, todayStart),
  ).length;
  const emergencyRows = emergencyList
    .map((r) => rowBase(r, r.status ?? "в работе", ageDays(r)))
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  // Overdue
  const overdueEntries = open
    .filter(isOverdue)
    .map((r) => {
      const target = r.delivery_date ?? r.planned_delivery_date;
      const days = target
        ? Math.max(0, Math.round((Date.now() - new Date(target).getTime()) / 86400000))
        : 0;
      return { r, days };
    })
    .sort((a, b) => b.days - a.days);
  const overdueRows = overdueEntries.map(({ r, days }) =>
    rowBase(r, "просрочка поставки", days),
  );
  const maxOverdue = overdueEntries[0]?.days ?? 0;

  // Accounting
  const accountingList = open.filter((r) => ACCOUNTING_STATUSES.has(r.status ?? ""));
  const accountingRows = accountingList
    .map((r) => rowBase(r, "в бухгалтерии", ageDays(r)))
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
  const accountingAmount = accountingList.reduce(
    (s, r) => s + (totalAmount(r) || 0),
    0,
  );
  const accountingAvg = accountingList.length
    ? Math.round(
        accountingList.reduce((s, r) => s + ageDays(r), 0) / accountingList.length,
      )
    : 0;
  const accountingOverWeek = accountingList.filter((r) => ageDays(r) > 7).length;

  // Stalled
  const stalledList = open.filter((r) => ageDays(r) > STALE_DAYS);
  const stalledRows = stalledList
    .map((r) => rowBase(r, "нет движения", ageDays(r)))
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  // Arrivals today
  const arriveList = open.filter(
    (r) =>
      sameDay(r.delivery_date, todayStart) ||
      sameDay(r.planned_delivery_date, todayStart),
  );
  const arriveRows = arriveList.map((r) => rowBase(r, "ожидается сегодня", 0));

  // No supplier
  const noSupplierList = open.filter((r) => !r.contractor);
  const noSupplierRows = noSupplierList
    .map((r) => rowBase(r, "не назначен поставщик", ageDays(r)))
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  const summary: SnapshotSummary = {
    emergency_total: emergencyList.length,
    emergency_new_today: emergencyNewToday,
    overdue_total: overdueEntries.length,
    overdue_max_days: maxOverdue,
    accounting_total: accountingList.length,
    accounting_amount: Math.round(accountingAmount),
    accounting_avg_days: accountingAvg,
    accounting_over_week: accountingOverWeek,
    stalled_total: stalledList.length,
    arrive_today_total: arriveList.length,
    arrive_today_new_emergency: emergencyNewToday,
    no_supplier_total: noSupplierList.length,
  };

  return {
    summary,
    buckets: {
      emergency: emergencyRows,
      overdue: overdueRows,
      accounting: accountingRows,
      stalled: stalledRows,
      arrive_today: arriveRows,
      no_supplier: noSupplierRows,
    },
  };
}

// ---------- UI ----------

function BucketTable({
  rows,
  showAll,
  showAmount,
}: {
  rows: BucketRow[];
  showAll: boolean;
  showAmount: boolean;
}) {
  const visible = showAll ? rows : rows.slice(0, 5);
  return (
    <div className="mt-3 rounded-md border border-border/60 overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        <div className="col-span-1">№</div>
        <div className="col-span-4">Название</div>
        <div className="col-span-2">Объект</div>
        <div className="col-span-2">Ответственный</div>
        <div className="col-span-2">Причина</div>
        <div className="col-span-1 text-right">
          {showAmount ? "Сумма" : "Дней"}
        </div>
      </div>
      <ul className="divide-y divide-border/60">
        {visible.map((r) => (
          <li
            key={r.id}
            className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center hover:bg-accent/30"
          >
            <div className="col-span-1 text-xs text-muted-foreground font-numeric truncate">
              {r.request_number ?? "—"}
            </div>
            <div className="col-span-4 min-w-0">
              <Link
                to={`/requests/${r.id}`}
                className="text-primary hover:underline underline-offset-2 truncate block"
                title={r.description}
              >
                {r.description}
              </Link>
            </div>
            <div className="col-span-2 text-xs text-muted-foreground truncate">
              {r.object ?? "—"}
            </div>
            <div className="col-span-2 text-xs text-muted-foreground truncate">
              {r.executor ?? "—"}
            </div>
            <div className="col-span-2 text-xs text-muted-foreground truncate">
              {r.reason}
            </div>
            <div className="col-span-1 text-right text-xs font-numeric">
              {showAmount
                ? r.amount
                  ? fmtMoney(r.amount)
                  : "—"
                : r.days != null
                  ? `${r.days} дн.`
                  : "—"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BucketAccordionRow({
  meta,
  rows,
  expanded,
  onToggle,
  showAll,
  onToggleShowAll,
}: {
  meta: BucketMeta;
  rows: BucketRow[];
  expanded: boolean;
  onToggle: () => void;
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  const Icon = ICONS[meta.icon];
  const disabled = rows.length === 0;
  const totalAmountSum = rows.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition",
          disabled ? "cursor-default opacity-60" : "hover:bg-accent/40 cursor-pointer",
        )}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
            disabled && "opacity-0",
          )}
        />
        <Icon className={cn("h-4 w-4 shrink-0", toneClass(meta.tone))} />
        <div className="flex-1 text-sm font-medium">{meta.label}</div>
        {meta.showAmount && totalAmountSum > 0 && (
          <div className="text-xs text-muted-foreground font-numeric">
            {fmtMoney(totalAmountSum)}
          </div>
        )}
        <Badge
          variant={rows.length > 0 ? "secondary" : "outline"}
          className="font-numeric shrink-0"
        >
          {rows.length}
        </Badge>
      </button>
      {expanded && rows.length > 0 && (
        <div className="px-4 pb-4 bg-background">
          <BucketTable rows={rows} showAll={showAll} showAmount={meta.showAmount} />
          {rows.length > 5 && (
            <div className="mt-2 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleShowAll}
                className="text-xs"
              >
                {showAll ? "Свернуть" : `Показать все (${rows.length})`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Main component ----------

export function AiDayBrief({
  organizationId,
  requests,
  objectMap,
  userName,
}: {
  organizationId: string | null;
  requests: AnalyticsRequest[];
  objectMap: Record<string, string>;
  userName: string | null;
}) {
  const { toast } = useToast();
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [briefs, setBriefs] = useState<SavedBrief[]>([]);
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  const isToday = selectedDate === todayIso;

  const liveSnapshot = useMemo(
    () => buildBriefSnapshot(requests, objectMap),
    [requests, objectMap],
  );

  // Load briefs for selected date
  useEffect(() => {
    if (!organizationId) return;
    let cancel = false;
    (async () => {
      setLoadingList(true);
      const { data, error } = await supabase
        .from("ai_day_briefs")
        .select(
          "id, brief_date, generated_at, created_by_name, narrative, metrics, buckets",
        )
        .eq("organization_id", organizationId)
        .eq("brief_date", selectedDate)
        .order("generated_at", { ascending: false });
      if (cancel) return;
      if (error) {
        setBriefs([]);
      } else {
        const list = (data ?? []) as unknown as SavedBrief[];
        setBriefs(list);
        // Auto-select latest saved version
        setSelectedBriefId(list[0]?.id ?? null);
      }
      setLoadingList(false);
    })();
    return () => {
      cancel = true;
    };
  }, [organizationId, selectedDate]);

  const activeBrief = selectedBriefId
    ? briefs.find((b) => b.id === selectedBriefId) ?? null
    : null;

  // For details: use saved brief buckets if a saved brief is selected, else live buckets
  const activeBuckets = activeBrief?.buckets ?? liveSnapshot.buckets;

  const todayHasBrief = isToday && briefs.length > 0;

  const handleGenerate = async () => {
    if (!organizationId) return;
    setGenerating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Требуется вход");
      const snapshot = buildBriefSnapshot(requests, objectMap);

      // Call AI for narrative
      const { data: aiData, error: aiErr } = await supabase.functions.invoke(
        "analytics-day-prep",
        { body: { snapshot: { today: todayIso, ...snapshot.summary } } },
      );
      if (aiErr) throw aiErr;
      const narrative: string = aiData?.content ?? "";
      if (!narrative) throw new Error("AI вернул пустой ответ");

      // Persist snapshot with narrative
      const { data, error } = await supabase
        .from("ai_day_briefs")
        .insert({
          organization_id: organizationId,
          brief_date: todayIso,
          created_by: u.user.id,
          created_by_name: userName,
          narrative,
          metrics: snapshot.summary as any,
          buckets: snapshot.buckets as any,
        })
        .select(
          "id, brief_date, generated_at, created_by_name, narrative, metrics, buckets",
        )
        .single();
      if (error) throw error;
      const saved = data as unknown as SavedBrief;
      if (isToday) {
        setBriefs((prev) => [saved, ...prev]);
        setSelectedBriefId(saved.id);
      }
      toast({
        title: todayHasBrief ? "AI-сводка обновлена" : "AI-сводка сформирована",
        description: format(new Date(saved.generated_at), "d MMMM, HH:mm", {
          locale: ru,
        }),
      });
    } catch (e: any) {
      const msg = e?.message ?? "Не удалось сформировать сводку";
      toast({
        title: "Ошибка",
        description: msg.includes("402")
          ? "Закончились кредиты Lovable AI"
          : msg.includes("429")
            ? "Слишком много запросов. Попробуйте позже."
            : msg,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const setDateShortcut = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const yesterdayIso = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));
  const toggleShowAll = (k: string) =>
    setShowAll((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-4">
      {/* AI narrative card */}
      <Card className="p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-2">
            <div className="p-2 rounded-md bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-base">AI-резюме дня</div>
              <div className="text-xs text-muted-foreground">
                {activeBrief
                  ? `Снимок от ${format(
                      new Date(activeBrief.generated_at),
                      "d MMMM yyyy, HH:mm",
                      { locale: ru },
                    )}${
                      activeBrief.created_by_name
                        ? ` · ${activeBrief.created_by_name}`
                        : ""
                    }`
                  : isToday
                    ? "Ещё не сформировано за сегодня"
                    : "Нет сохранённой сводки на выбранную дату"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={isToday ? "secondary" : "outline"}
              onClick={() => setDateShortcut(0)}
            >
              Сегодня
            </Button>
            <Button
              size="sm"
              variant={selectedDate === yesterdayIso ? "secondary" : "outline"}
              onClick={() => setDateShortcut(-1)}
            >
              Вчера
            </Button>
            <Input
              type="date"
              value={selectedDate}
              max={todayIso}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 w-[150px]"
            />
            {briefs.length > 1 && (
              <Select
                value={selectedBriefId ?? ""}
                onValueChange={(v) => setSelectedBriefId(v)}
              >
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="Версия" />
                </SelectTrigger>
                <SelectContent>
                  {briefs.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {format(new Date(b.generated_at), "HH:mm")}
                      {b.created_by_name ? ` · ${b.created_by_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isToday && (
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
                className="gap-2"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : todayHasBrief ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {todayHasBrief ? "Обновить AI-сводку" : "Сформировать AI-сводку"}
              </Button>
            )}
          </div>
        </div>

        {loadingList || generating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            {generating ? "AI пишет сводку…" : "Загрузка…"}
          </div>
        ) : activeBrief?.narrative ? (
          <article className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
            <ReactMarkdown>{activeBrief.narrative}</ReactMarkdown>
          </article>
        ) : (
          <div className="text-sm text-muted-foreground py-6 text-center">
            {isToday
              ? "Нажмите «Сформировать AI-сводку», чтобы получить короткое описание ситуации."
              : "На эту дату сводка не сохранялась."}
          </div>
        )}
      </Card>

      {/* Details */}
      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <div className="font-semibold text-base">Детализация сводки</div>
            <div className="text-xs text-muted-foreground">
              Раскройте раздел, чтобы увидеть конкретные заявки
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {BUCKET_META.map((meta) => (
            <BucketAccordionRow
              key={meta.key}
              meta={meta}
              rows={activeBuckets[meta.key] ?? []}
              expanded={!!expanded[meta.key]}
              onToggle={() => toggle(meta.key)}
              showAll={!!showAll[meta.key]}
              onToggleShowAll={() => toggleShowAll(meta.key)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
