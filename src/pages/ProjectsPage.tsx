import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  FolderOpen,
  Plus,
  Package,
  Building2,
  ReceiptText,
  Truck,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Unlink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  useProjects,
  useAttachRequestsToProject,
  childTotal,
  type ProjectNode,
  type ProjectChild,
} from "@/hooks/useProjects";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { AddRequestsToProjectDialog } from "@/components/projects/AddRequestsToProjectDialog";

const money = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";

function statusClass(status: string) {
  switch (status) {
    case "Проект завершён":
      return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    case "Аварийная ситуация":
      return "bg-red-500/15 text-red-700 border-red-500/30";
    case "В пути":
      return "bg-blue-500/15 text-blue-700 border-blue-500/30";
    case "Ожидает оплаты":
      return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function Chip({
  icon: Icon,
  label,
  className,
}: {
  icon: any;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] bg-muted/60 text-muted-foreground ${className ?? ""}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function ChildRow({
  child,
  highlighted,
  onDetach,
}: {
  child: ProjectChild;
  highlighted: boolean;
  onDetach: (id: string) => void;
}) {
  const total = childTotal(child);
  return (
    <div
      className={`flex items-start gap-2 border-b border-border/40 px-3 py-2 last:border-b-0 ${
        highlighted ? "bg-amber-500/10" : "hover:bg-muted/30"
      }`}
    >
      <span className="mt-1 text-muted-foreground/60 select-none">├─</span>
      <div className="min-w-0 flex-1">
        <Link
          to={`/requests/${child.id}`}
          className="text-sm font-medium hover:underline break-words"
        >
          {child.description || child.request_number}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>Поставщик: <span className="text-foreground">{child.contractor || "—"}</span></span>
          <span>Счёт: <span className="text-foreground">{child.invoice_number || "—"}</span></span>
          <span className="font-numeric tabular-nums">
            Сумма: <span className="text-foreground">{total ? money(total) : "—"}</span>
          </span>
          {child.shipments_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {child.shipments_count}
            </span>
          )}
          {child.object_name && <span>Объект: {child.object_name}</span>}
        </div>
      </div>
      <Badge variant="outline" className="shrink-0 text-[10px]">
        {child.status}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        title="Убрать из проекта"
        onClick={() => onDetach(child.id)}
      >
        <Unlink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ProjectCard({
  project,
  expanded,
  onToggle,
  matchedChildIds,
  onAddRequests,
  onDetach,
}: {
  project: ProjectNode;
  expanded: boolean;
  onToggle: () => void;
  matchedChildIds: Set<string>;
  onAddRequests: () => void;
  onDetach: (id: string) => void;
}) {
  const s = project.summary;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-2 p-3">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onToggle}>
          <ChevronRight
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </Button>
        <FolderOpen className="mt-1 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/requests/${project.id}`}
              className="text-sm font-semibold hover:underline break-words"
            >
              {project.description || project.request_number}
            </Link>
            <Badge variant="outline" className={`text-[10px] ${statusClass(s.computedStatus)}`}>
              {s.computedStatus}
            </Badge>
            {s.overdue > 0 && (
              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-500/30">
                <AlertTriangle className="mr-1 h-3 w-3" /> Просрочено: {s.overdue}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {project.object_name && <span>Объект: {project.object_name}</span>}
            <span>Руководитель: {project.executor || "—"}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip icon={Package} label={`Заявок: ${s.requests}`} />
            <Chip icon={Building2} label={`Поставщиков: ${s.suppliers}`} />
            <Chip icon={ReceiptText} label={`Счетов: ${s.invoices}`} />
            <Chip icon={Truck} label={`Перевозок: ${s.shipments}`} />
            <Chip icon={Wallet} label={`Сумма: ${money(s.totalAmount)}`} />
            <Chip icon={TrendingUp} label={`Выполнено: ${s.progress}%`} />
          </div>

          <div className="mt-2 flex items-center gap-3">
            <Progress value={s.progress} className="h-1.5 max-w-xs" />
            <span className="text-[11px] text-muted-foreground font-numeric tabular-nums">
              Оплачено {money(s.paidAmount)} · Не оплачено {money(s.unpaidAmount)} · Доставлено{" "}
              {s.delivered} · В пути {s.inTransit}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={onAddRequests}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Заявки
        </Button>
      </div>

      {expanded && (
        <div className="border-l-4 border-primary/40 bg-muted/20">
          {project.children.length === 0 ? (
            <div className="px-3 py-2 text-xs italic text-muted-foreground">
              В проекте пока нет заявок
            </div>
          ) : (
            project.children.map((c) => (
              <ChildRow
                key={c.id}
                child={c}
                highlighted={matchedChildIds.has(c.id)}
                onDetach={onDetach}
              />
            ))
          )}
        </div>
      )}
    </Card>
  );
}

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const attach = useAttachRequestsToProject();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [addTo, setAddTo] = useState<ProjectNode | null>(null);

  const terms = useMemo(
    () => search.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [search]
  );

  const { visible, matchedChildIds } = useMemo(() => {
    const matched = new Set<string>();
    if (!terms.length) return { visible: projects, matchedChildIds: matched };

    const hit = (parts: (string | null | undefined)[]) => {
      const hay = parts.filter(Boolean).join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    };

    const res: ProjectNode[] = [];
    for (const p of projects) {
      const pMatch = hit([p.description, p.request_number, p.object_name, p.executor]);
      const kids = p.children.filter((c) =>
        hit([c.description, c.request_number, c.contractor, c.invoice_number, c.status, c.object_name])
      );
      kids.forEach((c) => matched.add(c.id));
      if (pMatch || kids.length) res.push(p);
    }
    return { visible: res, matchedChildIds: matched };
  }, [projects, terms]);

  // Автораскрытие дерева при поиске совпадений внутри проекта
  useEffect(() => {
    if (!terms.length) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const p of projects) {
        if (p.children.some((c) => matchedChildIds.has(c.id))) next.add(p.id);
      }
      return next;
    });
  }, [terms.length, matchedChildIds, projects]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const detach = async (id: string) => {
    try {
      await attach.mutateAsync({ projectId: null, requestIds: [id] });
      toast({ title: "Заявка убрана из проекта" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  const totals = useMemo(() => {
    return projects.reduce(
      (acc, p) => ({
        requests: acc.requests + p.summary.requests,
        amount: acc.amount + p.summary.totalAmount,
        shipments: acc.shipments + p.summary.shipments,
      }),
      { requests: 0, amount: 0, shipments: 0 }
    );
  }, [projects]);

  return (
    <div className="space-y-4 p-3 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Проекты</h1>
          <p className="text-xs text-muted-foreground">
            Проектов: {projects.length} · Заявок в проектах: {totals.requests} · Общая сумма:{" "}
            {money(totals.amount)} · Перевозок: {totals.shipments}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setExpanded((prev) =>
                prev.size === projects.length ? new Set() : new Set(projects.map((p) => p.id))
              )
            }
          >
            {expanded.size === projects.length && projects.length > 0 ? "Свернуть всё" : "Развернуть всё"}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Новый проект
          </Button>
        </div>
      </header>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по проекту, материалу, поставщику, счёту…"
        className="max-w-lg"
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Загрузка проектов…</div>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {projects.length === 0
            ? "Проектов пока нет. Создайте первый проект и добавьте в него заявки."
            : "Ничего не найдено"}
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              expanded={expanded.has(p.id)}
              onToggle={() => toggle(p.id)}
              matchedChildIds={matchedChildIds}
              onAddRequests={() => setAddTo(p)}
              onDetach={detach}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      {addTo && (
        <AddRequestsToProjectDialog
          open={!!addTo}
          onOpenChange={(v) => !v && setAddTo(null)}
          projectId={addTo.id}
          projectName={addTo.description || addTo.request_number}
        />
      )}
    </div>
  );
}
