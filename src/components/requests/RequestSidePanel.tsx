import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X, Maximize2, Minimize2, FileText, Check, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Request } from "@/hooks/useRequests";
import { getStatusColor, getPriorityColor, STATUSES, PRIORITIES } from "@/hooks/useRequestsFilters";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface RequestSidePanelProps {
  request: (Request & { object_name?: string | null }) | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (request: Request) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  position?: number;
  requestCount?: number;
  /** Панель как колонка раскладки (широкий экран) вместо оверлея. */
  inline?: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
}

const DEFAULT_PANEL_WIDTH = 460;
const MIN_PANEL_WIDTH = 360;
const MAX_PANEL_WIDTH = 720;


const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const dt = (v?: string | null) => (v ? format(new Date(v), "dd.MM.yy") : "—");

const Row = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) => (
  <div className="flex items-start gap-3 py-[3px]">
    <div className="w-[86px] shrink-0 text-[10px] leading-4 text-muted-foreground">{label}</div>
    <div
      className={cn(
        "min-w-0 flex-1 text-[11px] leading-4 break-words",
        accent ? "text-primary" : "text-foreground"
      )}
    >
      {value || <span className="text-muted-foreground">—</span>}
    </div>
  </div>
);

export const RequestSidePanel = ({
  request,
  open,
  onClose,
  onEdit,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  position,
  requestCount,
  inline = false,
  width,
  onWidthChange,
}: RequestSidePanelProps) => {
  const [tab, setTab] = useState<"overview" | "items" | "docs" | "history">("overview");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localWidth, setLocalWidth] = useState(DEFAULT_PANEL_WIDTH);
  const panelWidth = width ?? localWidth;
  const applyWidth = useCallback(
    (next: number) => {
      const value = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, next));
      if (onWidthChange) onWidthChange(value);
      else setLocalWidth(value);
    },
    [onWidthChange]
  );
  const resizingRef = useRef(false);

  const stopResize = useCallback(() => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizingRef.current) return;
      applyWidth(window.innerWidth - event.clientX);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResize);
      stopResize();
    };
  }, [applyWidth, stopResize]);


  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowUp" && hasPrevious) {
        event.preventDefault();
        onPrevious?.();
      } else if (event.key === "ArrowDown" && hasNext) {
        event.preventDefault();
        onNext?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasNext, hasPrevious, onClose, onNext, onPrevious, open]);

  useEffect(() => {
    setTitleValue(request?.description || "");
    setEditingTitle(false);
  }, [request?.id, request?.description]);

  const saveField = async (field: "description" | "status" | "priority", val: string) => {
    if (!request) return;
    if (field === "description" && val) val = val.charAt(0).toUpperCase() + val.slice(1);
    setSavingField(field);
    try {
      const { error } = await supabase.from("requests").update({ [field]: val }).eq("id", request.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      if (field === "description") setEditingTitle(false);
    } catch (e) {
      console.error("SidePanel save:", e);
      toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
    } finally {
      setSavingField(null);
    }
  };

  const { data: items } = useQuery({
    queryKey: ["request-items", request?.id],
    queryFn: async () => {
      const requestId = request?.id;
      if (!requestId) return [];
      const { data, error } = await supabase
        .from("request_items")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!request?.id && open,
  });

  const { data: history } = useQuery({
    queryKey: ["request-audit", request?.id],
    queryFn: async () => {
      const requestId = request?.id;
      if (!requestId) return [];
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, created_at")
        .eq("entity_id", requestId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!request?.id && open && tab === "history",
  });

  const docs = useMemo(() => {
    if (!request) return [] as string[];
    const list = [
      ...(request.document_urls || []),
      ...(request.photo_urls || []),
    ].filter(Boolean) as string[];
    if (!list.length && request.document_url) list.push(request.document_url);
    return list;
  }, [request]);

  const goods = request?.amount || 0;
  const extra = ((request as any)?.amount_2 || 0) + ((request as any)?.amount_3 || 0);
  const total = goods + extra;
  const paid = (request as any)?.payment_percent ?? request?.payment_percentage ?? 0;

  const movement = useMemo(() => {
    if (!request) return [] as { title: string; sub: string; done: boolean }[];
    const steps: { title: string; sub: string; done: boolean }[] = [
      {
        title: "Заявка создана",
        sub: `${dt(request.request_date)}${request.applicant ? ` • ${request.applicant}` : ""}`,
        done: true,
      },
    ];
    if (request.invoice_number) {
      steps.push({
        title: "Счёт получен и согласован",
        sub: `${dt((request as any).invoice_date || request.request_date)}${request.executor ? ` • ${request.executor}` : ""}`,
        done: true,
      });
    }
    if (request.shipment_date) {
      steps.push({
        title: "Передано перевозчику, в пути",
        sub: `${dt(request.shipment_date)}${request.delivery_date ? ` • ожидается ${dt(request.delivery_date)}` : ""}`,
        done: !request.delivery_date,
      });
    }
    if ((request as any).actual_arrival_date) {
      steps.push({
        title: "Приход подтверждён",
        sub: `${dt((request as any).actual_arrival_date)}${request.received_by ? ` • ${request.received_by}` : ""}`,
        done: true,
      });
    }
    return steps;
  }, [request]);

  if (!open || !request) return null;

  const tabs = [
    { id: "overview", label: "Обзор" },
    { id: "items", label: `Позиции ${items?.length ?? ""}`.trim() },
    { id: "docs", label: `Документы ${docs.length || ""}`.trim() },
    { id: "history", label: "История" },
  ] as const;

  const asOverlay = !inline || isFullscreen;

  const content = (
    <aside
      className={cn(
        "requests-registry flex flex-col border-l border-border bg-card",
        asOverlay
          ? "fixed inset-y-0 right-0 z-50 max-w-[100vw] shadow-panel motion-reduce:animate-none"
          : "sticky top-2 h-[calc(100dvh-2rem)] w-full overflow-hidden"
      )}
      style={
        asOverlay
          ? {
              width: isFullscreen ? "100vw" : `min(${panelWidth}px, 92vw)`,
              transition: "width var(--dur) var(--ease)",
              animation: "slide-in-right var(--dur) var(--ease)",
            }
          : undefined
      }
      aria-label="Карточка заявки"
    >
      {!isFullscreen && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели"
          className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-primary/20"
          onMouseDown={(event) => {
            event.preventDefault();
            resizingRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-start gap-2 px-4 pt-3">
        {editingTitle ? (
          <div className="flex min-w-0 flex-1 items-start gap-1">
            <textarea
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (titleValue.trim()) saveField("description", titleValue.trim());
                } else if (e.key === "Escape") {
                  setTitleValue(request.description || "");
                  setEditingTitle(false);
                }
              }}
              rows={2}
              className="min-w-0 flex-1 resize-none rounded border border-input bg-background px-1.5 py-1 text-[13px] font-semibold leading-tight focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => titleValue.trim() && saveField("description", titleValue.trim())}
              className="mt-0.5 h-7 w-7 text-success hover:text-success"
              aria-label="Сохранить название"
            >
              {savingField === "description" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <h2
            className="min-w-0 flex-1 cursor-text rounded px-1 -mx-1 text-[13px] font-semibold leading-tight hover:bg-muted/50"
            title="Клик — редактировать название"
            onClick={() => setEditingTitle(true)}
          >
            {request.description}
          </h2>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevious} disabled={!hasPrevious} aria-label="Предыдущая заявка">
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onNext} disabled={!hasNext} aria-label="Следующая заявка">
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsFullscreen((value) => !value)} aria-label={isFullscreen ? "Свернуть панель" : "Развернуть на весь экран"}>
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Закрыть">
          <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-1.5 text-[10px] text-muted-foreground font-numeric">
        <select
          value={request.status}
          disabled={savingField === "status"}
          onChange={(e) => saveField("status", e.target.value)}
          className="h-6 cursor-pointer rounded border border-input bg-card pl-1.5 pr-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          style={{ borderLeft: `3px solid ${getStatusColor(request.status)}` }}
          aria-label="Статус"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={request.priority || "Планово"}
          disabled={savingField === "priority"}
          onChange={(e) => saveField("priority", e.target.value)}
          className="h-6 cursor-pointer rounded border border-input bg-card pl-1.5 pr-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          style={{ borderLeft: `3px solid ${getPriorityColor(request.priority || "Планово")}` }}
          aria-label="Приоритет"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <span className="font-numeric">{request.request_number}</span>
        <span className="font-numeric">{dt(request.request_date)}</span>
        {position && requestCount ? <span className="ml-auto font-numeric">{position} / {requestCount}</span> : null}
        {savingField && savingField !== "description" && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      {/* Tabs */}
      <div className="mt-2 flex gap-4 border-b border-border px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={cn(
              "relative pb-1.5 text-[10px] transition-colors",
              tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-[1.5px] bg-foreground/70" />}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {tab === "overview" && (
          <>
            <Row label="Объект" value={(request as any).object_name} />
            <Row label="Контрагент" value={request.contractor} />
            <Row label="Заявитель" value={request.applicant} accent />
            <Row label="Кто ведёт" value={request.executor} />
            <Row
              label="Перевозчик"
              value={[request.transport_company, request.waybill_number].filter(Boolean).join(", ")}
            />
            <Row label="Отгрузка" value={dt(request.shipment_date)} />
            <Row label="Приход" value={dt(request.delivery_date)} />

            {/* Totals */}
            <div className="mt-3 bg-muted/60 px-3 py-2.5">
              <div className="flex items-center justify-between py-[3px] text-[10px] text-muted-foreground">
                <span>Товар</span>
                <span className="font-numeric text-[11px] text-foreground">{money(goods)} ₽</span>
              </div>
              <div className="flex items-center justify-between py-[3px] text-[10px] text-muted-foreground">
                <span>Доставка</span>
                <span className="font-numeric text-[11px] text-foreground">{money(extra)} ₽</span>
              </div>
              <div className="mt-2 flex items-end justify-between border-t border-border pt-2">
                <span className="text-[10px] text-muted-foreground">Всего</span>
                <span className="font-numeric text-[15px] font-semibold tracking-tight">{money(total)} ₽</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className={paid >= 100 ? "text-success" : "text-warning"}>
                  {paid >= 100 ? "Оплачено полностью" : paid > 0 ? "Оплачено частично" : "Не оплачено"}
                </span>
                <span className="font-numeric text-muted-foreground">{paid} %</span>
              </div>
            </div>

            {/* Movement */}
            <div className="mt-4">
              <div className="mb-2 text-[10px] text-muted-foreground">Движение</div>
              <div className="space-y-2.5">
                {movement.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <span
                      className={cn(
                        "mt-[3px] h-2 w-2 shrink-0 rounded-full border",
                        m.done && i === movement.length - 1
                          ? "border-primary bg-primary"
                          : "border-border bg-card"
                      )}
                    />
                    <div className="min-w-0">
                      <div className="text-[10.5px] leading-4">{m.title}</div>
                      <div className="font-numeric text-[9.5px] leading-4 text-muted-foreground">{m.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "items" && (
          <div className="space-y-1">
            {(items || []).length === 0 && <div className="text-[11px] text-muted-foreground">Позиций нет</div>}
            {(items || []).map((it: any) => (
              <div key={it.id} className="flex items-start justify-between gap-2 border-b border-border/70 py-1.5">
                <div className="min-w-0">
                  <div className="text-[11px] leading-4">{it.name}</div>
                  {it.article && (
                    <div className="font-numeric text-[9.5px] text-muted-foreground">{it.article}</div>
                  )}
                </div>
                <div className="font-numeric text-[11px] text-muted-foreground">{it.quantity}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "docs" && (
          <div className="space-y-1">
            {docs.length === 0 && <div className="text-[11px] text-muted-foreground">Документов нет</div>}
            {docs.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 border-b border-border/70 py-1.5 text-[11px] hover:text-primary"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{decodeURIComponent(url.split("/").pop() || `Файл ${i + 1}`)}</span>
              </a>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-1">
            {(history || []).length === 0 && <div className="text-[11px] text-muted-foreground">Записей нет</div>}
            {(history || []).map((h: any) => (
              <div key={h.id} className="flex items-center justify-between gap-2 border-b border-border/70 py-1.5">
                <span className="truncate text-[11px]">{h.action}</span>
                <span className="font-numeric shrink-0 text-[9.5px] text-muted-foreground">
                  {h.created_at ? format(new Date(h.created_at), "dd.MM.yy HH:mm") : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-card px-4 py-2.5">
        <Button
          onClick={() => onEdit?.(request)}
          size="sm"
          className="h-7 px-3 text-[11px]"
        >
          Редактировать
        </Button>
      </div>
    </aside>,
    document.body
  );
};
