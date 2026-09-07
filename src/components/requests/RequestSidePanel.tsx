import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X, Maximize2, Minimize2, Loader2, ArrowUp, ArrowDown, MoreVertical, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Request } from "@/hooks/useRequests";
import { getStatusColor, getPriorityColor, STATUSES, PRIORITIES } from "@/hooks/useRequestsFilters";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useRequestParticipants } from "@/hooks/useRequestParticipants";
import { formatPersonName } from "@/lib/personName";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PanelField, PanelFieldOption } from "./PanelField";
import { PanelItemsTable } from "./PanelItemsTable";
import { PanelDocuments, UploadTask, detectKind, validateFile } from "./PanelDocuments";

interface RequestSidePanelProps {
  request: (Request & { object_name?: string | null }) | null;
  open: boolean;
  onClose: () => void;
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

const dt = (v?: string | null) => (v ? format(new Date(v), "dd.MM.yy") : null);

const sanitizeName = (name: string) => name.replace(/[^\w.\-]+/g, "_") || `file_${Date.now()}`;

export const RequestSidePanel = ({
  request,
  open,
  onClose,
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
  const { currentOrgId } = useCurrentOrganization();
  const { canEdit } = useUserRole();
  const { data: applicantsDir = [] } = useRequestParticipants("applicant", currentOrgId);
  const { data: executorsDir = [] } = useRequestParticipants("executor", currentOrgId);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportWide, setViewportWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1100);
  const [localWidth, setLocalWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const panelWidth = width ?? localWidth;
  const readOnly = !canEdit;

  useEffect(() => {
    const onResize = () => setViewportWide(window.innerWidth >= 1100);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    setUploads([]);
  }, [request?.id, request?.description]);

  /** Оптимистичное сохранение любого поля заявки + тост с «Отменить». */
  const saveField = useCallback(
    async (field: string, value: string | number | null, options?: { silent?: boolean }) => {
      if (!request) return;
      const previous = (request as any)[field] ?? null;
      let next: any = value;
      if (field === "description" && typeof next === "string" && next) {
        next = next.charAt(0).toUpperCase() + next.slice(1);
      }
      if (next === "") next = null;

      setSavingField(field);
      queryClient.setQueriesData({ queryKey: ["requests"] }, (old: any) =>
        Array.isArray(old) ? old.map((r: any) => (r?.id === request.id ? { ...r, [field]: next } : r)) : old
      );

      try {
        const { error } = await supabase.from("requests").update({ [field]: next }).eq("id", request.id);
        if (error) throw error;
        if (!options?.silent) {
          toast({
            title: "Сохранено",
            duration: 5000,
            action: (
              <ToastAction altText="Отменить" onClick={() => saveField(field, previous, { silent: true })}>
                Отменить
              </ToastAction>
            ),
          });
        }
        queryClient.invalidateQueries({ queryKey: ["requests"] });
      } catch (e) {
        console.error("SidePanel save:", e);
        queryClient.setQueriesData({ queryKey: ["requests"] }, (old: any) =>
          Array.isArray(old) ? old.map((r: any) => (r?.id === request.id ? { ...r, [field]: previous } : r)) : old
        );
        toast({ title: "Не удалось сохранить", description: "Значение осталось прежним", variant: "destructive" });
      } finally {
        setSavingField(null);
      }
    },
    [queryClient, request, toast]
  );

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

  const { data: objects } = useQuery({
    queryKey: ["panel-objects", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("material_objects")
        .select("id, name")
        .eq("organization_id", currentOrgId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId && open,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["panel-suppliers", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select("name")
        .eq("organization_id", currentOrgId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId && open,
  });

  const { data: carriers } = useQuery({
    queryKey: ["panel-carriers", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("requests")
        .select("transport_company")
        .eq("organization_id", currentOrgId)
        .not("transport_company", "is", null)
        .limit(1000);
      if (error) throw error;
      return Array.from(new Set((data || []).map((r: any) => r.transport_company).filter(Boolean))).sort();
    },
    enabled: !!currentOrgId && open,
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

  const photoUrls = useMemo(() => (request?.photo_urls || []).filter(Boolean) as string[], [request]);
  const documentUrls = useMemo(() => {
    const list = [...((request?.document_urls || []) as string[])].filter(Boolean);
    if (!list.length && request?.document_url) list.push(request.document_url);
    return list;
  }, [request]);
  const docsCount = photoUrls.length + documentUrls.length;

  /** Загрузка файлов: свой прогресс и своя ошибка у каждого файла. */
  const handleUpload = useCallback(
    async (files: File[]) => {
      if (!request || readOnly) return;
      for (const file of files) {
        const id = `${file.name}-${Date.now()}-${Math.random()}`;
        const problem = validateFile(file);
        if (problem) {
          setUploads((u) => [...u, { id, name: file.name, progress: 0, error: problem }]);
          continue;
        }
        setUploads((u) => [...u, { id, name: file.name, progress: 5 }]);
        const kind = detectKind(file);
        const bucket = kind === "photo" ? "request-photos" : "request-documents";
        const column = kind === "photo" ? "photo_urls" : "document_urls";
        const path = `${request.request_number}/${Date.now()}-${sanitizeName(file.name)}`;
        const tick = setInterval(
          () => setUploads((u) => u.map((t) => (t.id === id && t.progress < 90 ? { ...t, progress: t.progress + 10 } : t))),
          200
        );
        try {
          const { error } = await supabase.storage.from(bucket).upload(path, file);
          if (error) throw error;
          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          const nextList = [...(kind === "photo" ? photoUrls : documentUrls), data.publicUrl];
          const { error: updateError } = await supabase
            .from("requests")
            .update({ [column]: nextList })
            .eq("id", request.id);
          if (updateError) throw updateError;
          setUploads((u) => u.map((t) => (t.id === id ? { ...t, progress: 100 } : t)));
          setTimeout(() => setUploads((u) => u.filter((t) => t.id !== id)), 1200);
          queryClient.invalidateQueries({ queryKey: ["requests"] });
        } catch (e) {
          console.error("upload:", e);
          setUploads((u) =>
            u.map((t) => (t.id === id ? { ...t, error: "Файл не загрузился. Проверьте связь и попробуйте ещё раз." } : t))
          );
        } finally {
          clearInterval(tick);
        }
      }
      if (files.length) setTab("docs");
    },
    [documentUrls, photoUrls, queryClient, readOnly, request]
  );

  const goods = request?.amount || 0;
  const extra = ((request as any)?.amount_2 || 0) + ((request as any)?.amount_3 || 0);
  const total = goods + extra;
  const paid = (request as any)?.payment_percent ?? request?.payment_percentage ?? 0;

  const applicantOptions: PanelFieldOption[] = useMemo(
    () => applicantsDir.map((p) => ({ value: p.name, label: p.label })),
    [applicantsDir]
  );
  const executorOptions: PanelFieldOption[] = useMemo(
    () => executorsDir.map((p) => ({ value: p.name, label: p.label })),
    [executorsDir]
  );
  const objectOptions: PanelFieldOption[] = useMemo(
    () => (objects || []).map((o: any) => ({ value: o.id, label: o.name })),
    [objects]
  );
  const supplierOptions: PanelFieldOption[] = useMemo(
    () => (suppliers || []).map((s: any) => ({ value: s.name, label: s.name })),
    [suppliers]
  );
  const carrierOptions: PanelFieldOption[] = useMemo(
    () => (carriers || []).map((c: any) => ({ value: c, label: c })),
    [carriers]
  );

  const movement = useMemo(() => {
    if (!request) return [] as { title: string; sub: string; done: boolean }[];
    const steps: { title: string; sub: string; done: boolean }[] = [
      {
        title: "Заявка создана",
        sub: `${dt(request.request_date) ?? "—"}${request.applicant ? ` • ${formatPersonName(request.applicant)}` : ""}`,
        done: true,
      },
    ];
    if (request.invoice_number) {
      steps.push({
        title: "Счёт получен и согласован",
        sub: `${dt((request as any).invoice_date || request.request_date) ?? "—"}${request.executor ? ` • ${formatPersonName(request.executor)}` : ""}`,
        done: true,
      });
    }
    if (request.shipment_date) {
      steps.push({
        title: "Передано перевозчику, в пути",
        sub: `${dt(request.shipment_date) ?? "—"}${request.delivery_date ? ` • ожидается ${dt(request.delivery_date)}` : ""}`,
        done: !request.delivery_date,
      });
    }
    if ((request as any).actual_arrival_date) {
      steps.push({
        title: "Приход подтверждён",
        sub: `${dt((request as any).actual_arrival_date) ?? "—"}${request.received_by ? ` • ${formatPersonName(request.received_by)}` : ""}`,
        done: true,
      });
    }
    return steps;
  }, [request]);

  if (!open || !request) return null;

  // Боковая панель — только быстрая правка: поля и файлы.
  // Позиции, история и прочее тяжёлое живут в полном экране.
  const tabs = [
    { id: "overview", label: "Обзор" },
    { id: "docs", label: `Документы ${docsCount || ""}`.trim() },
  ] as const;


  const asOverlay = !inline || isFullscreen;

  const fieldsBlock = (
    <>
            <PanelField
              label="Объект"
              type="select"
              options={objectOptions}
              value={request.object_id}
              display={(request as any).object_name}
              readOnly={readOnly}
              onSave={(v) => saveField("object_id", v)}
            />
            <PanelField
              label="Контрагент"
              type="select"
              options={supplierOptions}
              value={request.contractor}
              readOnly={readOnly}
              onSave={(v) => saveField("contractor", v)}
            />
            <PanelField
              label="Заявитель"
              type="select"
              options={applicantOptions}
              value={request.applicant}
              display={formatPersonName(request.applicant)}
              readOnly={readOnly}
              onSave={(v) => saveField("applicant", v)}
            />
            <PanelField
              label="Кто ведёт"
              type="select"
              options={executorOptions}
              value={request.executor}
              display={formatPersonName(request.executor)}
              readOnly={readOnly}
              onSave={(v) => saveField("executor", v)}
            />
            <PanelField
              label="Перевозчик"
              type="select"
              options={carrierOptions}
              value={request.transport_company}
              readOnly={readOnly}
              onSave={(v) => saveField("transport_company", v)}
            />
            <PanelField
              label="№ ТТН"
              type="text"
              value={request.waybill_number}
              readOnly={readOnly}
              onSave={(v) => saveField("waybill_number", v)}
            />
            <PanelField
              label="№ счёта"
              type="text"
              value={request.invoice_number}
              readOnly={readOnly}
              onSave={(v) => saveField("invoice_number", v)}
            />
            <PanelField
              label="Отгрузка"
              type="date"
              value={request.shipment_date}
              display={dt(request.shipment_date)}
              readOnly={readOnly}
              onSave={(v) => saveField("shipment_date", v)}
            />
            <PanelField
              label="Приход"
              type="date"
              value={request.delivery_date}
              display={dt(request.delivery_date)}
              readOnly={readOnly}
              onSave={(v) => saveField("delivery_date", v)}
            />
    </>
  );
  const totalsBlock = (
    <div className="mx-0 w-full max-w-[480px]">
            <div className="mt-3 bg-muted/60 px-3 py-2.5">
              <PanelField
                label="Товар"
                type="number"
                value={goods}
                display={<span className="font-numeric">{money(goods)} ₽</span>}
                readOnly={readOnly}
                onSave={(v) => saveField("amount", Number(v.replace(",", ".")) || 0)}
              />
              <PanelField
                label="Доставка"
                type="number"
                value={(request as any).amount_2 || 0}
                display={<span className="font-numeric">{money(extra)} ₽</span>}
                readOnly={readOnly}
                onSave={(v) => saveField("amount_2", Number(v.replace(",", ".")) || 0)}
              />
              <div className="mt-2 flex items-end justify-between border-t border-border pt-2">
                <span className="text-[10px] text-muted-foreground">Всего</span>
                <span className="font-numeric text-[15px] font-semibold tracking-tight">{money(total)} ₽</span>
              </div>
              <PanelField
                label="Оплата"
                type="number"
                value={paid}
                display={
                  <span className={paid >= 100 ? "text-success" : paid > 0 ? "text-warning" : "text-muted-foreground"}>
                    {paid} % — {paid >= 100 ? "оплачено полностью" : paid > 0 ? "оплачено частично" : "не оплачено"}
                  </span>
                }
                readOnly={readOnly}
                onSave={(v) => {
                  const pct = Math.min(100, Math.max(0, Number(v.replace(",", ".")) || 0));
                  return saveField("payment_percent", pct);
                }}
              />
            </div>
    </div>
  );
  const movementBlock = (
    <>
            <div className="mt-4">
              <div className="mb-2 text-[10px] text-muted-foreground">Движение</div>
              <div className="space-y-2.5">
                {movement.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <span
                      className={cn(
                        "mt-[3px] h-2 w-2 shrink-0 rounded-full border",
                        m.done && i === movement.length - 1 ? "border-primary bg-primary" : "border-border bg-card"
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
  );
  const itemsBlock = (
          <PanelItemsTable
            requestId={request.id}
            organizationId={currentOrgId}
            items={(items || []) as any}
            readOnly={readOnly}
            onTotalChange={(itemsTotal) => {
              if (itemsTotal > 0 && Math.abs(itemsTotal - goods) > 0.009) {
                void saveField("amount", itemsTotal, { silent: true });
              }
            }}
          />
  );
  const docsBlock = (
          <PanelDocuments
            requestId={request.id}
            requestNumber={request.request_number}
            photoUrls={photoUrls}
            documentUrls={documentUrls}
            readOnly={readOnly}
            uploads={uploads}
            onUpload={handleUpload}
          />
  );
  const historyBlock = (
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
  );
  const wideFullscreen = isFullscreen && viewportWide;

  const content = (
    <aside
      className={cn(
        "requests-registry flex flex-col border-l border-border bg-card",
        dragActive && "ring-2 ring-inset ring-primary",
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
      onDragOver={(e) => {
        if (readOnly) return;
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragActive(false);
      }}
      onDrop={(e) => {
        if (readOnly) return;
        e.preventDefault();
        setDragActive(false);
        handleUpload(Array.from(e.dataTransfer.files));
      }}
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
      <div className={cn("flex items-start gap-2 px-4 pt-3", wideFullscreen && "mx-auto w-full max-w-[1440px]")}>
        {editingTitle && !readOnly ? (
          <textarea
            autoFocus
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              if (titleValue.trim() && titleValue.trim() !== request.description) saveField("description", titleValue.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              } else if (e.key === "Escape") {
                setTitleValue(request.description || "");
                setEditingTitle(false);
              }
            }}
            rows={2}
            className="min-w-0 flex-1 resize-none rounded border border-input bg-background px-1.5 py-1 text-[13px] font-semibold leading-tight focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <h2
            className={cn(
              "min-w-0 flex-1 rounded px-1 -mx-1 text-[13px] font-semibold leading-tight",
              !readOnly && "cursor-text hover:bg-muted/50"
            )}
            title={readOnly ? undefined : "Клик — изменить название"}
            onClick={() => !readOnly && setEditingTitle(true)}
          >
            {request.description}
            {savingField === "description" && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
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

      <div className={cn("flex flex-wrap items-center gap-2 px-4 pt-1.5 text-[10px] text-muted-foreground font-numeric", wideFullscreen && "mx-auto w-full max-w-[1440px]")}>
        <select
          value={request.status}
          disabled={readOnly || savingField === "status"}
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
          disabled={readOnly || savingField === "priority"}
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
        <span className="font-numeric">{dt(request.request_date) ?? "—"}</span>
        {position && requestCount ? <span className="ml-auto font-numeric">{position} / {requestCount}</span> : null}
        {savingField && savingField !== "description" && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      {/* Tabs — в полноэкранном режиме на широком экране всё видно сразу */}
      {!wideFullscreen && (
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
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {wideFullscreen ? (
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[420px_minmax(0,1fr)_360px] gap-6">
            <div className="min-w-0">
              {fieldsBlock}
              {totalsBlock}
            </div>
            <div className="min-w-0">{itemsBlock}</div>
            <div className="min-w-0 space-y-5">
              {docsBlock}
              <div>{movementBlock}</div>
              <div>
                <div className="mb-2 text-[10px] text-muted-foreground">История</div>
                {historyBlock}
              </div>
            </div>
          </div>
        ) : (
          <>
            {tab !== "docs" && (
              <>
                {fieldsBlock}
                {totalsBlock}
                {/* Позиции живут в полном экране */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  className="mt-3 flex w-full items-center justify-between rounded border border-border px-2 py-1.5 text-[11px] hover:bg-muted/60"
                >
                  <span>Позиции: {items?.length || 0}</span>
                  <span className="text-primary">Открыть на полный экран</span>
                </button>
                {movementBlock}
              </>
            )}
            {tab === "docs" && docsBlock}
          </>
        )}

      </div>

      {/* Footer */}
      <div className="sticky bottom-0 border-t border-border bg-card px-4 py-2.5">
        <div className={cn("flex items-center gap-2", wideFullscreen && "mx-auto w-full max-w-[1440px]")}>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-3 text-[11px]"
          disabled={readOnly || request.status === "Доставлено"}
          onClick={() => saveField("status", "Доставлено")}
        >
          <PackageCheck className="h-3.5 w-3.5" />
          Отметить приход
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" aria-label="Ещё">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[130]">
            <DropdownMenuItem onClick={() => window.open(`/requests/${request.id}`, "_blank")}>
              Открыть в новой вкладке
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/requests/${request.id}`);
                toast({ title: "Ссылка скопирована" });
              }}
            >
              Скопировать ссылку
            </DropdownMenuItem>
            <DropdownMenuItem disabled={readOnly} onClick={() => setTab("docs")}>
              Добавить файлы
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </aside>
  );

  return asOverlay ? createPortal(content, document.body) : content;
};
