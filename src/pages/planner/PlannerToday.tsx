import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, isToday, isThisWeek } from "date-fns";
import { ru } from "date-fns/locale";
import {
  AlertOctagon,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Send,
  Sparkles,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import {
  daysBetween,
  isOverdue,
  totalAmount,
  useAnalyticsRequests,
  AnalyticsRequest,
} from "@/hooks/useAnalyticsRequests";
import { usePlannerScope } from "@/contexts/PlannerScopeContext";
import PlannerTodayManual from "./PlannerTodayManual";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type PlannerRow = {
  id: string;
  organization_id: string;
  title: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  due_date: string | null;
  source: string;
  source_rule: string | null;
  request_id: string | null;
  created_at: string;
  updated_at: string;
};

const PRIORITY_RANK: Record<string, number> = {
  critical: 4,
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const PRIORITY_STYLE: Record<string, { label: string; bar: string; chip: string }> = {
  critical: { label: "Критический", bar: "bg-red-500", chip: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
  urgent: { label: "Критический", bar: "bg-red-500", chip: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
  high: { label: "Высокий", bar: "bg-orange-500", chip: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" },
  medium: { label: "Средний", bar: "bg-blue-500", chip: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  low: { label: "Низкий", bar: "bg-muted-foreground/40", chip: "bg-muted text-muted-foreground border-border" },
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "Вручную",
  crm_request: "Из CRM",
  auto_rule: "Авто",
};

const RULE_LABEL: Record<string, string> = {
  emergency_request: "Аварийная заявка",
  invoice_pending: "Счёт к оплате",
  delivery_due: "Контроль поставки",
  arrival_receipt: "Приёмка ТМЦ",
  status_stale: "Без движения",
};

/* -------------------------------------------------------------------------- */
/*  Hook: planner tasks for current org                                       */
/* -------------------------------------------------------------------------- */

function usePlannerRows() {
  const { currentOrgId } = useCurrentOrganization();
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!currentOrgId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("planner_tasks")
      .select("id,organization_id,title,status,priority,assignee_id,due_date,source,source_rule,request_id,created_at,updated_at")
      .eq("organization_id", currentOrgId)
      .eq("source", "auto_rule")
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500);
    setRows((data ?? []) as PlannerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!currentOrgId) return;
    const ch = supabase
      .channel(`planner-today-${currentOrgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planner_tasks", filter: `organization_id=eq.${currentOrgId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  return { rows, loading, reload: load };
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                    */
/* -------------------------------------------------------------------------- */

function dueBadge(due: string | null) {
  if (!due) return null;
  const d = new Date(due);
  const now = new Date();
  const overdueDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (overdueDays > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
        <Timer className="h-3 w-3" /> просрочено на {overdueDays} дн.
      </span>
    );
  }
  if (isToday(d)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
        <Timer className="h-3 w-3" /> сегодня
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Calendar className="h-3 w-3" /> {format(d, "d MMM", { locale: ru })}
    </span>
  );
}

function TaskCard({
  task,
  members,
  onChanged,
}: {
  task: PlannerRow;
  members: { id: string; full_name: string | null }[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const style = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.medium;
  const assignee = members.find((m) => m.id === task.assignee_id);
  const [busy, setBusy] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");

  const complete = async () => {
    setBusy("complete");
    const { error } = await supabase
      .from("planner_tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", task.id);
    setBusy(null);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Выполнено" });
      onChanged();
    }
  };

  const postpone = async (hours: number) => {
    setBusy("postpone");
    const base = task.due_date ? new Date(task.due_date) : new Date();
    const next = new Date(base.getTime() + hours * 3600000);
    const { error } = await supabase
      .from("planner_tasks")
      .update({ due_date: next.toISOString() })
      .eq("id", task.id);
    setBusy(null);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else onChanged();
  };

  const delegate = async (uid: string) => {
    setBusy("delegate");
    const { error } = await supabase
      .from("planner_tasks")
      .update({ assignee_id: uid, delegated_to: uid })
      .eq("id", task.id);
    setBusy(null);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Передано", description: members.find((m) => m.id === uid)?.full_name ?? "" });
      onChanged();
    }
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    setBusy("comment");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("planner_task_comments").insert({
      task_id: task.id,
      organization_id: task.organization_id,
      content: comment.trim(),
      author_id: u.user?.id ?? null,
    } as never);
    setBusy(null);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else {
      setComment("");
      setCommentOpen(false);
      toast({ title: "Комментарий добавлен" });
    }
  };

  return (
    <div className="relative flex flex-col rounded-xl border bg-card overflow-hidden">
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", style.bar)} />
      <div className="p-3 pl-4 flex-1">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium leading-snug break-words">{task.title}</div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", style.chip)}>
                {style.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {task.source_rule ? RULE_LABEL[task.source_rule] ?? SOURCE_LABEL[task.source] : SOURCE_LABEL[task.source]}
              </Badge>
              {dueBadge(task.due_date)}
            </div>
            {assignee && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                <UserCheck className="h-3 w-3" />
                {assignee.full_name ?? "—"}
              </div>
            )}
          </div>
        </div>

        {commentOpen && (
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
              placeholder="Комментарий…"
              className="flex-1 h-9 rounded-md border bg-background px-2 text-sm"
            />
            <Button size="sm" onClick={addComment} disabled={busy === "comment"} className="h-9">
              <Send className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-stretch divide-x border-t bg-muted/30">
        <button
          onClick={complete}
          disabled={!!busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium hover:bg-accent/60 transition min-h-11"
        >
          {busy === "complete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Выполнить
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={!!busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium hover:bg-accent/60 transition min-h-11"
            >
              <Clock className="h-3.5 w-3.5" /> Отложить
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => postpone(1)}>+1 час</DropdownMenuItem>
            <DropdownMenuItem onClick={() => postpone(24)}>+1 день</DropdownMenuItem>
            <DropdownMenuItem onClick={() => postpone(24 * 3)}>+3 дня</DropdownMenuItem>
            <DropdownMenuItem onClick={() => postpone(24 * 7)}>+1 неделя</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <button
              disabled={!!busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium hover:bg-accent/60 transition min-h-11"
            >
              <Users className="h-3.5 w-3.5" /> Передать
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-1">
            <div className="max-h-72 overflow-y-auto">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => delegate(m.id)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2"
                >
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  {m.full_name ?? "—"}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="px-3 inline-flex items-center justify-center hover:bg-accent/60 min-h-11">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setCommentOpen((v) => !v)}>
              <MessageSquare className="h-3.5 w-3.5 mr-2" /> Комментарий
            </DropdownMenuItem>
            {task.request_id && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/requests/${task.request_id}`)}>
                  <ExternalLink className="h-3.5 w-3.5 mr-2" /> Перейти в заявку
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function RequestRow({ r, meta }: { r: AnalyticsRequest; meta?: string }) {
  return (
    <Link
      to={`/requests/${r.id}`}
      className="block rounded-md border border-border/60 hover:border-primary/40 hover:bg-accent/40 px-2.5 py-2 transition"
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{r.description || r.request_number || "Без названия"}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {[r.contractor, r.status].filter(Boolean).join(" • ")}
          </div>
        </div>
        {meta && <div className="text-[11px] font-numeric text-muted-foreground whitespace-nowrap">{meta}</div>}
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </Link>
  );
}

function BlockCard({
  title,
  description,
  icon: Icon,
  accent,
  count,
  children,
  empty = "Пусто",
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "red" | "orange" | "green" | "blue";
  count: number;
  children: React.ReactNode;
  empty?: string;
}) {
  const accentMap = {
    red: { bar: "bg-red-500", icon: "text-red-500" },
    orange: { bar: "bg-orange-500", icon: "text-orange-500" },
    green: { bar: "bg-emerald-500", icon: "text-emerald-500" },
    blue: { bar: "bg-blue-500", icon: "text-blue-500" },
  }[accent];

  return (
    <Card className="relative overflow-hidden flex flex-col">
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", accentMap.bar)} />
      <div className="p-4 pl-5 flex items-start justify-between gap-2 border-b">
        <div className="flex items-center gap-2.5">
          <Icon className={cn("h-5 w-5", accentMap.icon)} />
          <div>
            <div className="font-semibold text-sm">{title}</div>
            {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
          </div>
        </div>
        <Badge variant={count > 0 ? "secondary" : "outline"} className="font-numeric">
          {count}
        </Badge>
      </div>
      <div className="p-3 pl-4 space-y-2 max-h-[28rem] overflow-y-auto">
        {count === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">{empty}</div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

const CLOSED_STATUSES = new Set(["Доставлено", "Отменено", "Отклонено", "Закрыто", "Архив"]);

function isOpen(r: AnalyticsRequest) {
  return !r.archived && !CLOSED_STATUSES.has(r.status ?? "");
}

export default function PlannerToday() {
  const plannerScope = usePlannerScope();
  if (plannerScope === "manual") {
    return <PlannerTodayManual />;
  }
  return <PlannerTodayCrm />;
}

function PlannerTodayCrm() {
  const { rows, loading: loadingTasks, reload } = usePlannerRows();
  const { data: requests, loading: loadingReq } = useAnalyticsRequests();
  const { data: members } = useOrgMembers();
  const [me, setMe] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [scope, setScope] = useState<"me" | "all">("me");
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data.user?.id ?? null);
    })();
  }, []);

  const memberList = useMemo(
    () => (members ?? []).map((m) => ({ id: m.user_id, full_name: m.full_name ?? m.email ?? "—" })),
    [members],
  );

  const open = useMemo(() => requests.filter(isOpen), [requests]);

  // ---- Urgent (red) ----
  const myTasks = useMemo(() => rows.filter((t) => scope === "all" || t.assignee_id === me), [rows, scope, me]);

  const urgentTasks = myTasks
    .filter((t) => ["critical", "urgent"].includes(t.priority))
    .sort((a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0));

  const urgentRequests = open
    .filter((r) => (r.priority ?? "").toLowerCase().includes("авар") || isOverdue(r))
    .slice(0, 15);

  // ---- Attention (orange) ----
  const attentionLists = [
    { label: "Счёт в бухгалтерии", items: open.filter((r) => (r.status ?? "").toLowerCase().includes("бухгалт")) },
    { label: "Без поставщика", items: open.filter((r) => !r.contractor) },
    { label: "Без ТК", items: open.filter((r) => !r.transport_company && r.shipment_date) },
    { label: "Без даты отгрузки", items: open.filter((r) => !r.shipment_date) },
    { label: "Без исполнителя", items: open.filter((r) => !r.executor) },
  ];

  // ---- Today (green) ----
  const todayTasks = myTasks.filter((t) => t.due_date && isToday(new Date(t.due_date)));
  const overdueTasks = myTasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && !isToday(new Date(t.due_date)));
  const weekTasks = myTasks.filter((t) => t.due_date && isThisWeek(new Date(t.due_date), { weekStartsOn: 1 }) && !isToday(new Date(t.due_date)));

  // ---- Delegated (blue) ----
  const delegated = rows.filter((t) => t.assignee_id && t.assignee_id !== me);
  const byAssignee = useMemo(() => {
    const m = new Map<string, PlannerRow[]>();
    for (const t of delegated) {
      const k = t.assignee_id!;
      const arr = m.get(k) ?? [];
      arr.push(t);
      m.set(k, arr);
    }
    return Array.from(m.entries())
      .map(([uid, tasks]) => ({
        uid,
        name: memberList.find((mb) => mb.id === uid)?.full_name ?? "—",
        total: tasks.length,
        overdue: tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date()).length,
      }))
      .sort((a, b) => b.total - a.total);
  }, [delegated, memberList]);

  const generateAi = async () => {
    if (!currentOrgId) return;
    setAiLoading(true);
    try {
      const snapshot = {
        today: format(new Date(), "yyyy-MM-dd"),
        my_tasks: myTasks.map((t) => ({ title: t.title, priority: t.priority, due: t.due_date, rule: t.source_rule })),
        delegated_summary: byAssignee,
        urgent_requests: urgentRequests.slice(0, 10).map((r) => ({
          id: r.id,
          description: r.description,
          priority: r.priority,
          status: r.status,
          executor: r.executor,
        })),
        attention: attentionLists.map((b) => ({ label: b.label, count: b.items.length })),
      };
      const { data, error } = await supabase.functions.invoke("planner-daily-brief", {
        body: { organization_id: currentOrgId, snapshot },
      });
      if (error) throw error;
      setAiContent(data?.content ?? null);
    } catch (e: any) {
      toast({ title: "Ошибка AI", description: e?.message ?? "Ошибка", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  if (loadingTasks || loadingReq) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Сегодня</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM", { locale: ru })} · {myTasks.length} задач
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={scope} onValueChange={(v) => setScope(v as "me" | "all")}>
            <TabsList className="h-9">
              <TabsTrigger value="me">Мои</TabsTrigger>
              <TabsTrigger value="all">Все</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={generateAi} disabled={aiLoading} variant="outline" className="gap-2">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI-план дня
          </Button>
        </div>
      </div>

      {aiContent && (
        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5" />
            <div className="font-semibold text-sm">План на сегодня</div>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">{aiContent}</div>
        </Card>
      )}

      {/* 4 main blocks */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* 🔴 Urgent */}
        <BlockCard
          title="Срочно"
          description="Аварии, просрочки, критический приоритет"
          icon={AlertOctagon}
          accent="red"
          count={urgentTasks.length + urgentRequests.length}
          empty="Срочных дел нет"
        >
          {urgentTasks.map((t) => (
            <TaskCard key={t.id} task={t} members={memberList} onChanged={reload} />
          ))}
          {urgentRequests.map((r) => (
            <RequestRow
              key={r.id}
              r={r}
              meta={
                isOverdue(r)
                  ? `+${daysBetween(r.delivery_date ?? r.planned_delivery_date, new Date().toISOString()) ?? 0} дн.`
                  : "авария"
              }
            />
          ))}
        </BlockCard>

        {/* 🟠 Attention */}
        <BlockCard
          title="Требуют внимания"
          description="Проблемные заявки в работе"
          icon={AlertTriangle}
          accent="orange"
          count={attentionLists.reduce((s, b) => s + b.items.length, 0)}
          empty="Всё под контролем"
        >
          {attentionLists.map((b) =>
            b.items.length === 0 ? null : (
              <div key={b.label} className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  {b.label}
                  <Badge variant="outline" className="font-numeric h-5">
                    {b.items.length}
                  </Badge>
                </div>
                {b.items.slice(0, 5).map((r) => (
                  <RequestRow key={r.id} r={r} />
                ))}
                {b.items.length > 5 && (
                  <div className="text-[11px] text-muted-foreground px-1">…и ещё {b.items.length - 5}</div>
                )}
              </div>
            ),
          )}
        </BlockCard>

        {/* 🟢 Today plan */}
        <BlockCard
          title="План на сегодня"
          description="Мои задачи и просрочки"
          icon={CheckCircle2}
          accent="green"
          count={todayTasks.length + overdueTasks.length + weekTasks.length}
          empty="На сегодня задач нет"
        >
          {overdueTasks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-red-600 mb-1.5">Просрочено · {overdueTasks.length}</div>
              <div className="space-y-2">
                {overdueTasks.map((t) => (
                  <TaskCard key={t.id} task={t} members={memberList} onChanged={reload} />
                ))}
              </div>
            </div>
          )}
          {todayTasks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5 mt-2">Сегодня</div>
              <div className="space-y-2">
                {todayTasks.map((t) => (
                  <TaskCard key={t.id} task={t} members={memberList} onChanged={reload} />
                ))}
              </div>
            </div>
          )}
          {weekTasks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5 mt-2">На этой неделе</div>
              <div className="space-y-2">
                {weekTasks.slice(0, 5).map((t) => (
                  <TaskCard key={t.id} task={t} members={memberList} onChanged={reload} />
                ))}
              </div>
            </div>
          )}
        </BlockCard>

        {/* 🔵 Delegated */}
        <BlockCard
          title="Делегировано"
          description="Контроль за сотрудниками"
          icon={Users}
          accent="blue"
          count={delegated.length}
          empty="Никому ничего не делегировано"
        >
          {byAssignee.map((a) => (
            <div key={a.uid} className="rounded-md border bg-card p-2.5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="flex items-center gap-1.5">
                  {a.overdue > 0 && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-red-500/10 text-red-600 border-red-500/30">
                      проср. {a.overdue}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="h-5 px-1.5 font-numeric text-[10px]">
                    {a.total}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </BlockCard>
      </div>
    </div>
  );
}
