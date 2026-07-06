import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Loader2,
  Receipt,
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

type Metric = {
  key: BucketKey;
  icon: string; // icon key
  tone: "default" | "warning" | "danger" | "success";
  text: string; // full short line
  count: number;
};

type BriefSnapshot = {
  metrics: Metric[];
  buckets: Record<BucketKey, BucketRow[]>;
};

type SavedBrief = {
  id: string;
  brief_date: string;
  generated_at: string;
  created_by_name: string | null;
  metrics: Metric[];
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

const toneClass = (t: Metric["tone"]) =>
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
  const emergencyNew = emergencyList.filter(
    (r) => (daysBetween(r.created_at, new Date().toISOString()) ?? 0) === 0,
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
        ? Math.max(
            0,
            Math.round(
              (Date.now() - new Date(target).getTime()) / 86400000,
            ),
          )
        : 0;
      return { r, days };
    })
    .sort((a, b) => b.days - a.days);
  const overdueRows = overdueEntries.map(({ r, days }) =>
    rowBase(r, "просрочка поставки", days),
  );
  const maxOverdue = overdueEntries[0]?.days ?? 0;

  // Accounting
  const accountingList = open.filter((r) =>
    ACCOUNTING_STATUSES.has(r.status ?? ""),
  );
  const accountingRows = accountingList
    .map((r) => rowBase(r, "в бухгалтерии", ageDays(r)))
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
  const accountingSum = accountingList.reduce(
    (s, r) => s + (totalAmount(r) || 0),
    0,
  );
  const accountingAvg = accountingList.length
    ? Math.round(
        accountingList.reduce((s, r) => s + ageDays(r), 0) /
          accountingList.length,
      )
    : 0;

  // Stalled > 5 days
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
  const arriveRows = arriveList.map((r) =>
    rowBase(r, "ожидается сегодня", 0),
  );

  // No supplier
  const noSupplierList = open.filter((r) => !r.contractor);
  const noSupplierRows = noSupplierList
    .map((r) => rowBase(r, "не назначен поставщик", ageDays(r)))
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  const metrics: Metric[] = [
    {
      key: "emergency",
      icon: "AlertTriangle",
      tone: "danger",
      count: emergencyList.length,
      text: `${emergencyList.length} аварийных заявок в работе${
        emergencyNew > 0 ? `, из них ${emergencyNew} новых` : ""
      }.`,
    },
    {
      key: "overdue",
      icon: "AlertTriangle",
      tone: "danger",
      count: overdueEntries.length,
      text: `${overdueEntries.length} заявок просрочены${
        maxOverdue > 0 ? ` (максимум на ${maxOverdue} дн.)` : ""
      }.`,
    },
    {
      key: "accounting",
      icon: "Wallet",
      tone: "warning",
      count: accountingList.length,
      text: `${accountingList.length} счетов на ${fmtMoney(
        accountingSum,
      )} зависли в бухгалтерии${
        accountingAvg > 0 ? ` (в среднем ${accountingAvg} дн.)` : ""
      }.`,
    },
    {
      key: "stalled",
      icon: "Clock",
      tone: "warning",
      count: stalledList.length,
      text: `${stalledList.length} заявок не двигаются более ${STALE_DAYS} дней.`,
    },
    {
      key: "arrive_today",
      icon: "Truck",
      tone: "success",
      count: arriveList.length,
      text: `Сегодня ожидается ${arriveList.length} поступлений товара.`,
    },
    {
      key: "no_supplier",
      icon: "UserX",
      tone: "warning",
      count: noSupplierList.length,
      text: `${noSupplierList.length} заявок без назначенного поставщика.`,
    },
  ];

  const buckets: BriefSnapshot["buckets"] = {
    emergency: emergencyRows,
    overdue: overdueRows,
    accounting: accountingRows,
    stalled: stalledRows,
    arrive_today: arriveRows,
    no_supplier: noSupplierRows,
  };

  return { metrics, buckets };
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

function MetricRow({
  metric,
  bucket,
  expanded,
  onToggle,
  showAllByKey,
  onShowAll,
}: {
  metric: Metric;
  bucket: BucketRow[];
  expanded: boolean;
  onToggle: () => void;
  showAllByKey: boolean;
  onShowAll: () => void;
}) {
  const Icon = (ICONS as any)[metric.icon] ?? Clock;
  const showAmount = metric.key === "accounting";
  const disabled = bucket.length === 0;

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition",
          disabled
            ? "cursor-default opacity-60"
            : "hover:bg-accent/40 cursor-pointer",
        )}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
            disabled && "opacity-0",
          )}
        />
        <Icon className={cn("h-4 w-4 shrink-0", toneClass(metric.tone))} />
        <div className="flex-1 text-sm">{metric.text}</div>
        <Badge
          variant={metric.count > 0 ? "secondary" : "outline"}
          className="font-numeric shrink-0"
        >
          {metric.count}
        </Badge>
      </button>
      {expanded && bucket.length > 0 && (
        <div className="px-4 pb-4 bg-background">
          <BucketTable
            rows={bucket}
            showAll={showAllByKey}
            showAmount={showAmount}
          />
          {bucket.length > 5 && (
            <div className="mt-2 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={onShowAll}
                className="text-xs"
              >
                {showAllByKey
                  ? "Свернуть"
                  : `Показать все (${bucket.length})`}
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
  const [saving, setSaving] = useState(false);
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
          "id, brief_date, generated_at, created_by_name, metrics, buckets",
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
        // Auto-select latest when browsing past dates; today defaults to live
        if (!isToday && list.length > 0) {
          setSelectedBriefId(list[0].id);
        } else {
          setSelectedBriefId(null);
        }
      }
      setLoadingList(false);
    })();
    return () => {
      cancel = true;
    };
  }, [organizationId, selectedDate, isToday]);

  const activeBrief = selectedBriefId
    ? briefs.find((b) => b.id === selectedBriefId) ?? null
    : null;

  const activeSnapshot: BriefSnapshot = activeBrief
    ? { metrics: activeBrief.metrics, buckets: activeBrief.buckets }
    : liveSnapshot;

  const todayHasBrief = isToday && briefs.length > 0;

  const handleSave = async () => {
    if (!organizationId) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Требуется вход");
      const snapshot = buildBriefSnapshot(requests, objectMap);
      const { data, error } = await supabase
        .from("ai_day_briefs")
        .insert({
          organization_id: organizationId,
          brief_date: todayIso,
          created_by: u.user.id,
          created_by_name: userName,
          metrics: snapshot.metrics as any,
          buckets: snapshot.buckets as any,
        })
        .select(
          "id, brief_date, generated_at, created_by_name, metrics, buckets",
        )
        .single();
      if (error) throw error;
      const saved = data as unknown as SavedBrief;
      // Refresh only if we're on today
      if (isToday) {
        setBriefs((prev) => [saved, ...prev]);
        setSelectedBriefId(null); // stay on live "текущее" by default
      }
      toast({
        title: "AI-сводка сохранена",
        description: format(new Date(saved.generated_at), "d MMMM, HH:mm", {
          locale: ru,
        }),
      });
    } catch (e: any) {
      toast({
        title: "Ошибка сохранения",
        description: e?.message ?? "Не удалось сохранить сводку",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const setDateShortcut = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const yesterdayIso = format(
    new Date(Date.now() - 86400000),
    "yyyy-MM-dd",
  );

  const toggle = (k: string) =>
    setExpanded((p) => ({ ...p, [k]: !p[k] }));
  const toggleShowAll = (k: string) =>
    setShowAll((p) => ({ ...p, [k]: !p[k] }));

  return (
    <Card className="p-4 md:p-5">
      {/* Header */}
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
                  ? "Текущее состояние — по данным CRM в реальном времени"
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
          {briefs.length > 0 && (
            <Select
              value={selectedBriefId ?? "live"}
              onValueChange={(v) =>
                setSelectedBriefId(v === "live" ? null : v)
              }
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Версия" />
              </SelectTrigger>
              <SelectContent>
                {isToday && (
                  <SelectItem value="live">Текущее состояние</SelectItem>
                )}
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
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {todayHasBrief ? "Обновить AI-сводку" : "Сформировать AI-сводку"}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {loadingList ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
        </div>
      ) : !isToday && !activeBrief ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          На эту дату сводка не сохранялась.
        </div>
      ) : (
        <>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
            Главное
          </div>
          <div className="space-y-2">
            {activeSnapshot.metrics.map((m) => (
              <MetricRow
                key={m.key}
                metric={m}
                bucket={activeSnapshot.buckets[m.key] ?? []}
                expanded={!!expanded[m.key]}
                onToggle={() => toggle(m.key)}
                showAllByKey={!!showAll[m.key]}
                onShowAll={() => toggleShowAll(m.key)}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
