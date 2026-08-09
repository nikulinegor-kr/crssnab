import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSpreadsheet, FileText, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";

type Row = {
  id: string;
  request_number: string | null;
  request_date: string | null;
  created_at: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  executor: string | null;
  contractor: string | null;
  object_id: string | null;
  object_name: string | null;
  amount: number | null;
  amount_2: number | null;
  amount_3: number | null;
  payment_percentage: number | null;
  payment_status: string | null;
  invoice_date: string | null;
  payment_date: string | null;
  shipment_date: string | null;
  delivery_date: string | null;
  planned_delivery_date: string | null;
  archived: boolean | null;
};

type Decision = "Да" | "Нет" | "Требует проверки";

const PAGE = 1000;
const PAID_STATUSES = new Set(["Оплачен", "Оплачено"]);
const DELIVERED_STATUSES = new Set(["Доставлено"]);
const CLOSED_STATUSES = new Set(["Доставлено", "Отменено", "Отклонено", "Закрыто"]);

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const monthKey = (d?: string | null) => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return format(dt, "yyyy-MM");
};
const monthLabel = (k: string | null) => {
  if (!k) return "—";
  const [y, m] = k.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
};
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "—" : format(dt, "dd.MM.yyyy");
};
const money = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;

const sum3 = (r: Row) => (r.amount ?? 0) + (r.amount_2 ?? 0) + (r.amount_3 ?? 0);
const isPaid = (r: Row) =>
  PAID_STATUSES.has(r.payment_status ?? "") || (r.payment_percentage ?? 0) >= 100;

type Enriched = Row & {
  total: number;
  paid: boolean;
  createdMonth: string | null;
  paidMonth: string | null;
  shippedMonth: string | null;
  deliveredMonth: string | null;
  inPeriod: boolean;
  carryForward: boolean;
  carriedIn: boolean;
  overdue: boolean;
  tone: "green" | "yellow" | "blue" | "purple" | "red" | "none";
  autoDecision: Decision;
};

const TONE_STYLE: Record<string, string> = {
  green: "bg-emerald-500/10 hover:bg-emerald-500/20",
  yellow: "bg-amber-500/10 hover:bg-amber-500/20",
  blue: "bg-sky-500/10 hover:bg-sky-500/20",
  purple: "bg-violet-500/10 hover:bg-violet-500/20",
  red: "bg-destructive/10 hover:bg-destructive/20",
  none: "hover:bg-muted/40",
};
const TONE_DOT: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  blue: "🔵",
  purple: "🟣",
  red: "🔴",
  none: "⚪",
};

type QuickFilter =
  | "all"
  | "paid"
  | "unpaid"
  | "carry"
  | "delivered"
  | "shipped"
  | "emergency"
  | "priority";

export default function RequestsRegistryPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const now = new Date();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<number>(now.getMonth());
  const [year, setYear] = useState<number>(now.getFullYear());
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [quick, setQuick] = useState<QuickFilter>("all");
  const [objectFilter, setObjectFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [executorFilter, setExecutorFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [overrides, setOverrides] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState(false);

  const periodKey = useMemo(
    () =>
      customFrom && customTo
        ? `${customFrom}..${customTo}`
        : `${year}-${String(month + 1).padStart(2, "0")}`,
    [customFrom, customTo, year, month],
  );

  const range = useMemo(() => {
    if (customFrom && customTo) {
      const from = new Date(customFrom);
      const to = new Date(customTo);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    const base = new Date(year, month, 1);
    return { from: startOfMonth(base), to: endOfMonth(base) };
  }, [customFrom, customTo, year, month]);

  const inRange = (d?: string | null) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return !Number.isNaN(t) && t >= range.from.getTime() && t <= range.to.getTime();
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentOrgId) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const all: Row[] = [];
        let from = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await supabase
            .from("requests")
            .select(
              "id,request_number,request_date,created_at,description,status,priority,executor,contractor,object_id,amount,amount_2,amount_3,payment_percentage,payment_status,invoice_date,payment_date,shipment_date,delivery_date,planned_delivery_date,archived,request_objects(name)",
            )
            .eq("organization_id", currentOrgId)
            .order("created_at", { ascending: false })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(
            ...data.map((r: any) => ({ ...r, object_name: r.request_objects?.name ?? null })),
          );
          if (data.length < PAGE) break;
          from += PAGE;
        }
        if (!cancelled) setRows(all);
      } catch (e: any) {
        if (!cancelled)
          toast({ title: "Ошибка загрузки", description: e?.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId, toast]);

  useEffect(() => {
    let cancelled = false;
    async function loadOverrides() {
      if (!currentOrgId) return;
      const { data } = await supabase
        .from("report_inclusions")
        .select("request_id,decision")
        .eq("organization_id", currentOrgId)
        .eq("period", periodKey);
      if (cancelled) return;
      const map: Record<string, Decision> = {};
      (data ?? []).forEach((d: any) => (map[d.request_id] = d.decision as Decision));
      setOverrides(map);
    }
    loadOverrides();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId, periodKey]);

  const enriched: Enriched[] = useMemo(() => {
    return rows.map((r) => {
      const created = r.request_date ?? r.created_at;
      const createdMonth = monthKey(created);
      const paid = isPaid(r);
      const paidDate = paid ? r.payment_date ?? r.invoice_date : null;
      const paidMonth = monthKey(paidDate);
      const shippedMonth = monthKey(r.shipment_date);
      const deliveredMonth = monthKey(
        DELIVERED_STATUSES.has(r.status ?? "") ? r.delivery_date : null,
      );

      const createdIn = inRange(created);
      const paidIn = inRange(paidDate);
      const shippedIn = inRange(r.shipment_date);
      const deliveredIn = DELIVERED_STATUSES.has(r.status ?? "") && inRange(r.delivery_date);
      const touches = createdIn || paidIn || shippedIn || deliveredIn;

      const closed = CLOSED_STATUSES.has(r.status ?? "");
      const finishedAfter =
        !deliveredIn &&
        (!closed ||
          (r.delivery_date ? new Date(r.delivery_date).getTime() > range.to.getTime() : true));

      const carryForward = touches && finishedAfter;
      const carriedIn =
        !createdIn &&
        !!created &&
        new Date(created).getTime() < range.from.getTime() &&
        (paidIn || shippedIn || deliveredIn || !closed);

      const target = r.delivery_date ?? r.planned_delivery_date;
      const overdue =
        !closed &&
        !r.archived &&
        !!target &&
        new Date(target).getTime() < Date.now();

      let tone: Enriched["tone"] = "none";
      if (overdue && touches) tone = "red";
      else if (createdIn && paidIn && shippedIn && deliveredIn) tone = "green";
      else if (deliveredIn) tone = "purple";
      else if (createdIn && carryForward) tone = "yellow";
      else if (!createdIn && (paidIn || shippedIn)) tone = "blue";

      const total = sum3(r);
      let autoDecision: Decision = "Нет";
      if (touches) {
        if (total <= 0) autoDecision = "Требует проверки";
        else if (paidIn || deliveredIn || shippedIn) autoDecision = "Да";
        else if (createdIn && carryForward) autoDecision = "Требует проверки";
        else autoDecision = "Да";
      }

      return {
        ...r,
        total,
        paid,
        createdMonth,
        paidMonth,
        shippedMonth,
        deliveredMonth,
        inPeriod: touches,
        carryForward,
        carriedIn,
        overdue,
        tone,
        autoDecision,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, range.from, range.to]);

  const periodRows = useMemo(
    () => enriched.filter((r) => r.inPeriod || r.carriedIn),
    [enriched],
  );

  const objects = useMemo(
    () => Array.from(new Set(periodRows.map((r) => r.object_name).filter(Boolean))).sort() as string[],
    [periodRows],
  );
  const suppliers = useMemo(
    () => Array.from(new Set(periodRows.map((r) => r.contractor).filter(Boolean))).sort() as string[],
    [periodRows],
  );
  const executors = useMemo(
    () => Array.from(new Set(periodRows.map((r) => r.executor).filter(Boolean))).sort() as string[],
    [periodRows],
  );

  const decisionOf = (r: Enriched): Decision => overrides[r.id] ?? r.autoDecision;

  const filtered = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return periodRows.filter((r) => {
      if (objectFilter !== "all" && r.object_name !== objectFilter) return false;
      if (supplierFilter !== "all" && r.contractor !== supplierFilter) return false;
      if (executorFilter !== "all" && r.executor !== executorFilter) return false;
      if (quick === "paid" && !r.paid) return false;
      if (quick === "unpaid" && r.paid) return false;
      if (quick === "carry" && !r.carryForward && !r.carriedIn) return false;
      if (quick === "delivered" && !inRange(r.delivery_date)) return false;
      if (quick === "shipped" && !inRange(r.shipment_date)) return false;
      if (quick === "emergency" && r.priority !== "Аварийно") return false;
      if (quick === "priority" && !["Аварийно", "Высокий", "Срочно"].includes(r.priority ?? ""))
        return false;
      if (terms.length) {
        const hay = [
          r.request_number,
          r.description,
          r.object_name,
          r.contractor,
          r.executor,
          r.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodRows, objectFilter, supplierFilter, executorFilter, quick, search, range.from, range.to]);

  const stats = useMemo(() => {
    const createdIn = filtered.filter((r) => inRange(r.request_date ?? r.created_at));
    const paidIn = filtered.filter((r) => r.paid && inRange(r.payment_date ?? r.invoice_date));
    const shippedIn = filtered.filter((r) => inRange(r.shipment_date));
    const deliveredIn = filtered.filter(
      (r) => DELIVERED_STATUSES.has(r.status ?? "") && inRange(r.delivery_date),
    );
    const carry = filtered.filter((r) => r.carryForward);
    const fromPrev = filtered.filter((r) => r.carriedIn);
    return {
      count: filtered.length,
      total: filtered.reduce((s, r) => s + r.total, 0),
      paidSum: paidIn.reduce((s, r) => s + r.total, 0),
      unpaidSum: filtered.filter((r) => !r.paid).reduce((s, r) => s + r.total, 0),
      createdIn: createdIn.length,
      paidIn: paidIn.length,
      shippedIn: shippedIn.length,
      deliveredIn: deliveredIn.length,
      carry: carry.length,
      carrySum: carry.reduce((s, r) => s + r.total, 0),
      fromPrev: fromPrev.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, range.from, range.to]);

  const setDecision = async (r: Enriched, decision: Decision) => {
    if (!currentOrgId) return;
    setOverrides((p) => ({ ...p, [r.id]: decision }));
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("report_inclusions").upsert(
      {
        organization_id: currentOrgId,
        request_id: r.id,
        period: periodKey,
        decision,
        updated_by: auth.user?.id ?? null,
      },
      { onConflict: "request_id,period" },
    );
    if (error) {
      toast({ title: "Не удалось сохранить", description: error.message, variant: "destructive" });
    }
  };

  const periodTitle =
    customFrom && customTo
      ? `${fmtDate(customFrom)} — ${fmtDate(customTo)}`
      : `${MONTHS[month]} ${year}`;

  const exportRows = () =>
    filtered.map((r, i) => ({
      "№ п/п": i + 1,
      "№ заявки": r.request_number ?? "—",
      "Дата создания": fmtDate(r.request_date ?? r.created_at),
      "Объект": r.object_name ?? "—",
      "Описание": r.description ?? "—",
      "Приоритет": r.priority ?? "—",
      "Исполнитель": r.executor ?? "—",
      "Поставщик": r.contractor ?? "—",
      "Сумма закупки": Math.round(r.total),
      "% оплаты": r.payment_percentage ?? 0,
      "Оплачено": r.paid ? "Да" : "Нет",
      "Дата счёта": fmtDate(r.invoice_date),
      "Дата оплаты": fmtDate(r.payment_date),
      "Дата отгрузки": fmtDate(r.shipment_date),
      "Дата доставки": fmtDate(r.delivery_date),
      "Статус": r.status ?? "—",
      "Отч. месяц создания": monthLabel(r.createdMonth),
      "Отч. месяц оплаты": monthLabel(r.paidMonth),
      "Отч. месяц отгрузки": monthLabel(r.shippedMonth),
      "Отч. месяц доставки": monthLabel(r.deliveredMonth),
      "Переходящая": r.carryForward ? "На следующий" : r.carriedIn ? "С прошлого" : "—",
      "Включить в отчёт": decisionOf(r),
    }));

  const exportExcel = async () => {
    if (!filtered.length) return toast({ title: "Нет данных для экспорта" });
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(exportRows());
      ws["!cols"] = [
        { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 40 }, { wch: 12 },
        { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Реестр");
      XLSX.writeFile(wb, `Реестр заявок ${periodTitle}.xlsx`);
    } catch (e: any) {
      toast({ title: "Ошибка экспорта", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!filtered.length) return toast({ title: "Нет данных для экспорта" });
    setBusy(true);
    try {
      const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      try {
        const buf = await fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer());
        const bytes = new Uint8Array(buf);
        let bin = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk)
          bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
        doc.addFileToVFS("Roboto-Regular.ttf", btoa(bin));
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.setFont("Roboto");
      } catch (e) {
        console.warn("font", e);
      }
      doc.setFontSize(14);
      doc.text(`Реестр заявок по отчётным периодам — ${periodTitle}`, 40, 40);
      doc.setFontSize(9);
      doc.text(
        `Заявок: ${stats.count} · Сумма: ${money(stats.total)} · Переходящих: ${stats.carry} (${money(stats.carrySum)})`,
        40,
        58,
      );
      autoTable(doc, {
        startY: 75,
        head: [[
          "№ заявки", "Создана", "Объект", "Описание", "Поставщик", "Сумма",
          "%", "Оплата", "Отгрузка", "Доставка", "Статус", "В отчёт",
        ]],
        body: filtered.map((r) => [
          r.request_number ?? "—",
          fmtDate(r.request_date ?? r.created_at),
          r.object_name ?? "—",
          r.description ?? "—",
          r.contractor ?? "—",
          money(r.total),
          `${r.payment_percentage ?? 0}%`,
          fmtDate(r.payment_date),
          fmtDate(r.shipment_date),
          fmtDate(r.delivery_date),
          r.status ?? "—",
          decisionOf(r),
        ]),
        styles: { font: "Roboto", fontSize: 7, cellPadding: 3, overflow: "linebreak" },
        headStyles: { font: "Roboto", fontStyle: "normal", fillColor: [31, 41, 55], textColor: 255, fontSize: 7 },
        bodyStyles: { font: "Roboto" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
      doc.save(`Реестр заявок ${periodTitle}.pdf`);
    } catch (e: any) {
      toast({ title: "Ошибка экспорта", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "paid", label: "Оплаченные" },
    { key: "unpaid", label: "Неоплаченные" },
    { key: "carry", label: "Переходящие" },
    { key: "shipped", label: "Отгруженные" },
    { key: "delivered", label: "Доставленные" },
    { key: "emergency", label: "Аварийные" },
    { key: "priority", label: "Приоритетные" },
  ];

  if (loading)
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Реестр заявок по отчётным периодам</h1>
          <p className="text-sm text-muted-foreground">
            Подготовка отчётности и контроль переходящих заявок · {periodTitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={busy} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={busy} className="gap-2">
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Период */}
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Месяц</div>
          <Select
            value={String(month)}
            onValueChange={(v) => {
              setMonth(Number(v));
              setCustomFrom("");
              setCustomTo("");
            }}
          >
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Год</div>
          <Select
            value={String(year)}
            onValueChange={(v) => {
              setYear(Number(v));
              setCustomFrom("");
              setCustomTo("");
            }}
          >
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 8 }, (_, i) => now.getFullYear() - 5 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Произвольный период</div>
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[150px]" />
            <span className="text-muted-foreground">—</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[150px]" />
            {(customFrom || customTo) && (
              <Button variant="ghost" size="icon" onClick={() => { setCustomFrom(""); setCustomTo(""); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Финансовая сводка */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Всего заявок" value={stats.count} />
        <Stat label="Сумма закупок" value={money(stats.total)} />
        <Stat label="Оплачено" value={money(stats.paidSum)} tone="text-emerald-600" />
        <Stat label="Не оплачено" value={money(stats.unpaidSum)} tone="text-amber-600" />
        <Stat label="Сумма переходящих" value={money(stats.carrySum)} tone="text-sky-600" />
      </div>

      {/* Аналитика по месяцам */}
      <Card className="p-4">
        <div className="text-sm font-medium mb-3">Аналитика по месяцам</div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 text-sm">
          <Mini label="Создано" value={stats.createdIn} />
          <Mini label="Оплачено" value={stats.paidIn} />
          <Mini label="Отгружено" value={stats.shippedIn} />
          <Mini label="Доставлено" value={stats.deliveredIn} />
          <Mini label="Перешло на след. месяц" value={stats.carry} />
          <Mini label="Пришло с прошлого" value={stats.fromPrev} />
        </div>
      </Card>

      {/* Фильтры */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {quickFilters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={quick === f.key ? "default" : "outline"}
              onClick={() => setQuick(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Поиск по заявке, объекту, поставщику…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-[280px]"
          />
          <FilterSelect value={objectFilter} onChange={setObjectFilter} items={objects} placeholder="Объект" />
          <FilterSelect value={supplierFilter} onChange={setSupplierFilter} items={suppliers} placeholder="Поставщик" />
          <FilterSelect value={executorFilter} onChange={setExecutorFilter} items={executors} placeholder="Исполнитель" />
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => {
              setQuick("all");
              setObjectFilter("all");
              setSupplierFilter("all");
              setExecutorFilter("all");
              setSearch("");
            }}
          >
            <Filter className="h-4 w-4" /> Сбросить
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>🟢 всё в месяце</span>
          <span>🟡 переходит на следующий</span>
          <span>🔵 создана раньше, работы в месяце</span>
          <span>🟣 доставлена в месяце</span>
          <span>🔴 просрочена</span>
        </div>
      </Card>

      {/* Таблица */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr className="text-left [&>th]:px-3 [&>th]:py-2 [&>th]:whitespace-nowrap [&>th]:font-medium">
                <th></th>
                <th>№ заявки</th>
                <th>Создана</th>
                <th>Объект</th>
                <th>Описание</th>
                <th>Приоритет</th>
                <th>Исполнитель</th>
                <th>Поставщик</th>
                <th className="text-right">Сумма</th>
                <th className="text-right">% опл.</th>
                <th>Оплачено</th>
                <th>Счёт</th>
                <th>Оплата</th>
                <th>Отгрузка</th>
                <th>Доставка</th>
                <th>Статус</th>
                <th>Месяц создания</th>
                <th>Месяц оплаты</th>
                <th>Месяц отгрузки</th>
                <th>Месяц доставки</th>
                <th>Переходящая</th>
                <th>Включить в отчёт</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={22} className="p-6 text-center text-muted-foreground">
                    Нет заявок за выбранный период
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t [&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap ${TONE_STYLE[r.tone]}`}
                >
                  <td>{TONE_DOT[r.tone]}</td>
                  <td className="font-numeric">{r.request_number ?? "—"}</td>
                  <td className="font-numeric">{fmtDate(r.request_date ?? r.created_at)}</td>
                  <td className="max-w-[180px] truncate" title={r.object_name ?? ""}>{r.object_name ?? "—"}</td>
                  <td className="max-w-[280px] truncate whitespace-normal">
                    <Link to={`/requests/${r.id}`} className="hover:underline">
                      {r.description ?? "—"}
                    </Link>
                  </td>
                  <td>{r.priority ?? "—"}</td>
                  <td className="max-w-[150px] truncate">{r.executor ?? "—"}</td>
                  <td className="max-w-[180px] truncate" title={r.contractor ?? ""}>{r.contractor ?? "—"}</td>
                  <td className="text-right font-numeric">{money(r.total)}</td>
                  <td className="text-right font-numeric">{r.payment_percentage ?? 0}%</td>
                  <td>
                    <Badge variant={r.paid ? "default" : "outline"}>{r.paid ? "Да" : "Нет"}</Badge>
                  </td>
                  <td className="font-numeric">{fmtDate(r.invoice_date)}</td>
                  <td className="font-numeric">{fmtDate(r.payment_date)}</td>
                  <td className="font-numeric">{fmtDate(r.shipment_date)}</td>
                  <td className="font-numeric">{fmtDate(r.delivery_date)}</td>
                  <td>{r.status ?? "—"}</td>
                  <td>{monthLabel(r.createdMonth)}</td>
                  <td>{monthLabel(r.paidMonth)}</td>
                  <td>{monthLabel(r.shippedMonth)}</td>
                  <td>{monthLabel(r.deliveredMonth)}</td>
                  <td>
                    {r.carryForward ? (
                      <Badge variant="secondary">На следующий</Badge>
                    ) : r.carriedIn ? (
                      <Badge variant="outline">С прошлого</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <Select value={decisionOf(r)} onValueChange={(v) => setDecision(r, v as Decision)}>
                      <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Да">Да</SelectItem>
                        <SelectItem value="Нет">Нет</SelectItem>
                        <SelectItem value="Требует проверки">Требует проверки</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Переходящие заявки */}
      <Card className="p-4">
        <div className="text-sm font-medium mb-3">
          Переходящие заявки ({filtered.filter((r) => r.carryForward || r.carriedIn).length})
        </div>
        <div className="divide-y">
          {filtered
            .filter((r) => r.carryForward || r.carriedIn)
            .map((r) => (
              <Link key={r.id} to={`/requests/${r.id}`} className="block py-2 hover:bg-muted/40 rounded px-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{r.description ?? r.request_number ?? "—"}</span>
                  <span className="font-numeric whitespace-nowrap">{money(r.total)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Создана: {monthLabel(r.createdMonth)} · Оплата: {monthLabel(r.paidMonth)} · Отгрузка:{" "}
                  {monthLabel(r.shippedMonth)} · Доставка: {monthLabel(r.deliveredMonth)}
                </div>
              </Link>
            ))}
          {!filtered.some((r) => r.carryForward || r.carriedIn) && (
            <div className="py-4 text-sm text-muted-foreground">Переходящих заявок нет</div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold font-numeric ${tone ?? ""}`}>{value}</div>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold font-numeric">{value}</div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  items,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  items: string[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        <SelectItem value="all">{placeholder}: все</SelectItem>
        {items.map((i) => (
          <SelectItem key={i} value={i}>{i}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
