import { formatRequestPublicNumber } from "@/lib/requestPublicNumber";
import { DELIVERED_STATUS, deliveryDatesError } from "@/lib/requestDeliveryValidation";
import { sendRequestToAppleReminders } from "@/lib/appleReminders";
import { TrackCargoButton } from "./TrackCargoButton";
import { useOrgStatuses } from "@/hooks/useOrgStatuses";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EquipmentSelectWithAdd } from "@/components/EquipmentSelectWithAdd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X, Maximize2, Minimize2, Loader2, ArrowUp, ArrowLeft, ArrowDown, MoreVertical, PackageCheck, FileText, Download, ExternalLink, Paperclip, Tag, ChevronDown } from "lucide-react";
import { LabelPrintDialog } from "@/components/request/LabelPrintDialog";
import { openStoredFile, downloadStoredFile } from "@/lib/storageUrl";
import { supabase } from "@/integrations/supabase/client";
import { Request } from "@/hooks/useRequests";
import { getStatusColor, getPriorityColor, PRIORITIES } from "@/hooks/useRequestsFilters";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useRequestParticipants } from "@/hooks/useRequestParticipants";
import { formatPersonName } from "@/lib/personName";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PanelField, PanelFieldOption } from "./PanelField";
import { PanelItemsTable } from "./PanelItemsTable";
import { PanelDocuments, UploadTask, detectKind, validateFile } from "./PanelDocuments";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import { LinkedPlannerTasks } from "@/components/request/LinkedPlannerTasks";
import { ClaudeRequestAssistant } from "./ClaudeRequestAssistant";
import { TrustLetterButton } from "./TrustLetterDialog";
import { RequestQrWorkflow } from "@/components/warehouse-qr/RequestQrWorkflow";
import { RequestQrButton } from '@/components/warehouse-qr/RequestQrButton';
import { RequestInlineField } from "./RequestInlineField";
import { RequestRoute } from "./RequestRoute";
import { getRequestObjectLabel, getRequestRouteStage, isRequestDeliveryConfirmed, REQUEST_ROUTE_LABELS } from "@/lib/requestCard";
import { getRequestFileUrls } from "@/lib/requestDocuments";
import { RequestDocumentDeleteButton } from "./RequestDocumentDeleteButton";
import { RequestInvoiceActions } from "./RequestInvoiceActions";
import { recognizeInvoiceFile } from "@/lib/recognizeInvoice";
import { buildInvoiceAutofill, invoiceAutofillMessage, mergeRecognizedItems, normalizeRecognizedItems } from "@/lib/invoiceAutofill";

interface RequestSidePanelProps {
  request: (Request & { object_name?: string | null }) | null;
  open: boolean;
  initialTab?: "overview" | "docs" | "tasks" | "history";
  qrEntry?: boolean;
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
  /** Полноэкранный режим — состояние хранится снаружи (в адресной строке). */
  fullscreen?: boolean;
  onFullscreenChange?: (value: boolean) => void;
  onRequestPatch?: (patch: Record<string, unknown>) => void;
}


const DEFAULT_PANEL_WIDTH = 560;
const MIN_PANEL_WIDTH = 360;
const MAX_PANEL_WIDTH = 720;

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const dt = (v?: string | null) => (v ? format(new Date(v), "dd.MM.yy") : null);

const sanitizeName = (name: string) => name.replace(/[^\w.\-]+/g, "_") || `file_${Date.now()}`;

export const RequestSidePanel = ({
  request: requestedRequest,
  open,
  initialTab = "overview",
  qrEntry = false,
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
  fullscreen,
  onFullscreenChange,
  onRequestPatch,
}: RequestSidePanelProps) => {
  const [editingRequest, setEditingRequest] = useState<RequestSidePanelProps["request"]>(null);
  const [localRequestPatch, setLocalRequestPatch] = useState<Record<string, unknown>>({});
  const baseRequest = requestedRequest ?? editingRequest;
  const request = baseRequest ? { ...baseRequest, ...localRequestPatch } as NonNullable<RequestSidePanelProps["request"]> : null;
  const STATUSES = useOrgStatuses();
  const isPhone = useIsMobile();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [tab, setTab] = useState<"overview" | "items" | "docs" | "history" | "tasks">("overview");
  const [positionsOpen, setPositionsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();
  const { canEdit } = useUserRole();
  const { data: applicantsDir = [] } = useRequestParticipants("applicant", currentOrgId);
  const { data: executorsDir = [] } = useRequestParticipants("executor", currentOrgId);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [localFullscreen, setLocalFullscreen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const isFullscreen = fullscreen ?? localFullscreen;
  const setIsFullscreen = useCallback(
    (value: boolean) => {
      if (onFullscreenChange) onFullscreenChange(value);
      else setLocalFullscreen(value);
    },
    [onFullscreenChange]
  );
  const [viewportWide, setViewportWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1100);
  const [localWidth, setLocalWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isRecognizingInvoice, setIsRecognizingInvoice] = useState(false);
  const [preserveInvoiceAmount, setPreserveInvoiceAmount] = useState(false);
  const [recognizedSupplier, setRecognizedSupplier] = useState<{ name: string; inn: string | null } | null>(null);
  const [, setActiveEditor] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const [statusPromptOpen, setStatusPromptOpen] = useState(false);
  const [receiptOpenSignal, setReceiptOpenSignal] = useState(0);
  const [pendingPaymentPercent, setPendingPaymentPercent] = useState<number | null>(null);
  const panelWidth = width ?? localWidth;
  const readOnly = !canEdit;

  const exitEditMode = useCallback(
    (confirmIfDirty: boolean) => {
      if (confirmIfDirty && editDirty && !window.confirm("Отменить правку? Часть изменений уже сохранена.")) return;
      setEditMode(false);
      setEditDirty(false);
    },
    [editDirty]
  );



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
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const invoiceAttachRef = useRef<HTMLInputElement>(null);


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
      const inField = !!target?.matches("input, textarea, select, [contenteditable='true']");
      if (editMode && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        setEditMode(false);
        setEditDirty(false);
        return;
      }
      if (inField) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (editMode) exitEditMode(true);
        else if (isFullscreen) setIsFullscreen(false);
        else onClose();
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
  }, [editMode, exitEditMode, hasNext, hasPrevious, isFullscreen, onClose, onNext, onPrevious, open, setIsFullscreen]);



  useEffect(() => {
    setLocalRequestPatch({});
    setEditMode(false);
    setAssistantOpen(false);
    setEditDirty(false);
    setReceiptOpenSignal(0);
    setActiveEditor(null);
    setTab(initialTab);
    setUploads([]);
    setRecognizedSupplier(null);
    setPreserveInvoiceAmount(false);
  }, [request?.id, open, initialTab]);

  const applyLocalRequestPatch = useCallback((patch: Record<string, unknown>) => {
    setLocalRequestPatch((previous) => ({ ...previous, ...patch }));
    onRequestPatch?.(patch);
  }, [onRequestPatch]);

  /** Оптимистичное сохранение любого поля заявки + тост с «Отменить». */
  const saveField = useCallback(
    async (field: string, value: string | number | null, options?: { silent?: boolean }) => {
      if (!request) return;
      if (field === "status" && value === DELIVERED_STATUS && request.status !== DELIVERED_STATUS) {
        const err = deliveryDatesError(request as any);
        if (err) {
          toast({ title: "Нельзя поставить «Доставлено»", description: err, variant: "destructive" });
          return;
        }
      }
      const previous = (request as any)[field] ?? null;
      let next: any = value;
      if (field === "description" && typeof next === "string" && next) {
        next = next.charAt(0).toUpperCase() + next.slice(1);
      }
      if (next === "") next = null;

      if (next !== previous) setEditDirty(true);
      setSavingField(field);
      const updateData: Record<string, string | number | null> = { [field]: next };
      if (field === "payment_percent") {
        updateData.payment_status = Number(next) >= 100 ? "Оплачено" : Number(next) > 0 ? "Частично оплачено" : "Не оплачено";
      }
      applyLocalRequestPatch(updateData);

      queryClient.setQueriesData({ queryKey: ["requests"] }, (old: any) =>
        Array.isArray(old) ? old.map((r: any) => (r?.id === request.id ? { ...r, ...updateData } : r)) : old
      );

      try {
        const { error } = await supabase.from("requests").update(updateData).eq("id", request.id);
        if (error) throw error;
        if (field === "status" && next === DELIVERED_STATUS && previous !== DELIVERED_STATUS) {
          setReceiptOpenSignal(n => n + 1);
        }
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
        applyLocalRequestPatch({ [field]: previous });
        queryClient.setQueriesData({ queryKey: ["requests"] }, (old: any) =>
          Array.isArray(old) ? old.map((r: any) => (r?.id === request.id ? { ...r, [field]: previous } : r)) : old
        );
        toast({ title: "Не удалось сохранить", description: "Значение осталось прежним", variant: "destructive" });
      } finally {
        setSavingField(null);
      }
    },
    [applyLocalRequestPatch, queryClient, request, toast]
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
        .from("request_objects")
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
        .select("id, name, inn")
        .eq("organization_id", currentOrgId)
        .order("name");
      if (error) throw error;
      return data || [];
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
    enabled: !!request?.id && open,
  });

  const photoUrls = useMemo(() => request ? getRequestFileUrls(request, "photo") : [], [request]);
  const documentUrls = useMemo(() => request ? getRequestFileUrls(request, "document") : [], [request]);
  const docsCount = photoUrls.length + documentUrls.length;

  /** Загрузка файлов: свой прогресс и своя ошибка у каждого файла. */
  const handleUpload = useCallback(
    async (files: File[], forcedKind?: "document") => {
      if (!request || readOnly) return;
      for (const file of files) {
        const id = `${file.name}-${Date.now()}-${Math.random()}`;
        const problem = validateFile(file);
        if (problem) {
          setUploads((u) => [...u, { id, name: file.name, progress: 0, error: problem }]);
          continue;
        }
        setUploads((u) => [...u, { id, name: file.name, progress: 5 }]);
        const kind = forcedKind ?? detectKind(file);
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
          applyLocalRequestPatch({ [column]: nextList });
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
    [applyLocalRequestPatch, documentUrls, photoUrls, queryClient, readOnly, request]
  );

  const handleRecognizeInvoice = async (file: File) => {
    if (!request || readOnly || isRecognizingInvoice) return;
    let addedItems = 0;
    let fieldsSaved = false;
    setIsRecognizingInvoice(true);
    try {
      const data = await recognizeInvoiceFile(file, "all");
      const result = buildInvoiceAutofill(data, 1, suppliers || []);
      if (!result.filledFields.length && !result.items.length) {
        toast({ title: "Не удалось распознать", description: invoiceAutofillMessage(result, 0, 0) || "Данные не найдены", variant: "destructive" });
        return;
      }

      const { data: currentItems, error: itemsReadError } = await supabase
        .from("request_items")
        .select("article, name, quantity, unit, price")
        .eq("request_id", request.id);
      if (itemsReadError) throw itemsReadError;
      const existing = normalizeRecognizedItems(currentItems || []);
      const merged = mergeRecognizedItems(existing, result.items);
      const additions = merged.items.slice(existing.length);
      if (result.patch.amount != null) setPreserveInvoiceAmount(true);
      if (additions.length) {
        const { error } = await supabase.from("request_items").insert(additions.map((item) => ({
          request_id: request.id,
          organization_id: request.organization_id,
          article: item.article || null,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price ?? 0,
        })));
        if (error) throw error;
        addedItems = additions.length;
      }

      if (Object.keys(result.patch).length) {
        const { error } = await supabase.from("requests").update(result.patch).eq("id", request.id);
        if (error) throw error;
        fieldsSaved = true;
        applyLocalRequestPatch(result.patch);
      }
      setRecognizedSupplier(result.contractorName && !result.matchedSupplier
        ? { name: result.contractorName, inn: result.contractorInn }
        : null);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["request-items", request.id] }),
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["request", request.id] }),
      ]);
      const alreadyAttached = documentUrls.some((url) => {
        try { return decodeURIComponent(url.split("/").pop() || "").replace(/^\d+-/, "") === file.name; }
        catch { return false; }
      });
      await handleUpload([...(alreadyAttached ? [] : [file]), ...(data.preparedFile ? [data.preparedFile] : [])], "document");
      toast({
        title: result.missing.length ? "Счёт распознан частично" : "Счёт распознан",
        description: [invoiceAutofillMessage(result, addedItems, result.items.length), data.preparationMessage].filter(Boolean).join(". "),
      });
    } catch (error) {
      const progress = [
        fieldsSaved ? "Реквизиты сохранены" : "",
        addedItems ? `Добавлено позиций: ${addedItems}` : "",
      ].filter(Boolean).join(". ");
      toast({
        title: fieldsSaved || addedItems ? "Счёт распознан частично" : "Ошибка распознавания",
        description: [progress, error instanceof Error ? error.message : "Не удалось обработать документ"].filter(Boolean).join(". "),
        variant: "destructive",
      });
    } finally {
      setIsRecognizingInvoice(false);
    }
  };

  const addRecognizedSupplier = async () => {
    if (!recognizedSupplier || !currentOrgId) return;
    const { error } = await supabase.from("suppliers").insert({
      organization_id: currentOrgId,
      name: recognizedSupplier.name,
      inn: recognizedSupplier.inn,
    });
    if (error) {
      toast({ title: "Не удалось добавить контрагента", description: error.message, variant: "destructive" });
      return;
    }
    setRecognizedSupplier(null);
    await queryClient.invalidateQueries({ queryKey: ["panel-suppliers", currentOrgId] });
    toast({ title: "Контрагент добавлен" });
  };

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

  if (!request || (!open && !editorOpen)) return null;

  // Боковая панель — только быстрая правка: поля и файлы.
  // Позиции, история и прочее тяжёлое живут в полном экране.
  const tabs = [
    { id: "overview", label: "Обзор" },
    { id: "tasks", label: "Задачи" },
    { id: "docs", label: `Документы ${docsCount || ""}`.trim() },
    { id: "history", label: "История" },
  ] as const;


  const asOverlay = !inline || isFullscreen;

  const cardClass = "request-side-card mt-3 w-full min-w-0 rounded-[16px] border border-border bg-card px-3 py-2.5 break-words";
  const cardTitleClass = "mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground";
  const peopleBlock = (
    <div className={cardClass}>
      <div className={cardTitleClass}>Объект и ответственные</div>
              <PanelField
              label="Объект"
              type="select"
              options={objectOptions}
              value={request.object_id}
              display={getRequestObjectLabel(request.object_id, objects?.find((object) => object.id === request.object_id)?.name || request.object_name)}
              readOnly={readOnly}
              alwaysEdit={editMode}
              onSave={(v) => saveField("object_id", v)}
            />
      {(/ремонт|восстановлен/i.test((request as any).object_name || "") || (request as any).equipment_id) && (
        <div className="flex min-h-9 items-center gap-2 py-1">
          <span className="w-[120px] shrink-0 text-[13px] text-muted-foreground">Техника</span>
          <div className="min-w-0 flex-1">
            <EquipmentSelectWithAdd
              value={(request as any).equipment_id || ""}
              onChange={(v) => void saveField("equipment_id", v || null)}
              organizationId={currentOrgId ?? null}
              disabled={readOnly}
            />
          </div>
        </div>
      )}
              <PanelField
              label="Заявитель"
              type="select"
              options={applicantOptions}
              value={request.applicant}
              display={formatPersonName(request.applicant)}
              readOnly={readOnly}
              alwaysEdit={editMode}
              onSave={(v) => saveField("applicant", v)}
            />
              <PanelField
              label="Кто ведёт"
              type="select"
              options={executorOptions}
              value={request.executor}
              display={formatPersonName(request.executor)}
              readOnly={readOnly}
              alwaysEdit={editMode}
              onSave={(v) => saveField("executor", v)}
            />
    </div>
  );
  const logisticsBlock = (
    <div className={cardClass}>
      <div className={cardTitleClass}>Логистика</div>
              <RequestInlineField
                label="Транспортная компания"
                value={request.transport_company}
                readOnly={readOnly}
                onEditingChange={(editing) => setActiveEditor(editing ? "carrier" : null)}
                onSave={(v) => saveField("transport_company", v)}
              />
              <PanelField
              label="№ ТТН"
              type="text"
              value={request.waybill_number}
              readOnly={readOnly}
              alwaysEdit={editMode}
              onSave={(v) => saveField("waybill_number", v)}
              copyable
              copyLabel="Номер ТТН скопирован"
              extraAction={<TrackCargoButton carrier={request.transport_company} ttn={request.waybill_number} />}
            />
              <div className="grid grid-cols-2 gap-3">
              <RequestInlineField
                label="Дата отгрузки"
                type="date"
                value={request.shipment_date}
                display={dt(request.shipment_date) || "—"}
                readOnly={readOnly}
                onEditingChange={(editing) => setActiveEditor(editing ? "shipment" : null)}
                onSave={(v) => saveField("shipment_date", v)}
              />
              <RequestInlineField
                label="Дата доставки"
                type="date"
                value={request.delivery_date}
                display={dt(request.delivery_date) || "—"}
                readOnly={readOnly}
                onEditingChange={(editing) => setActiveEditor(editing ? "delivery" : null)}
                onSave={(v) => saveField("delivery_date", v)}
              />
              </div>
    </div>
  );
  const invoiceNumberField = (
    <>
              <PanelField
              label="№ счёта"
              type="text"
              value={request.invoice_number}
              readOnly={readOnly}
              alwaysEdit={editMode}
              onSave={(v) => saveField("invoice_number", v)}
            />
              <PanelField
              label="Контрагент"
              type="select"
              options={supplierOptions}
              value={request.contractor}
              readOnly={readOnly}
              alwaysEdit={editMode}
              onSave={(v) => saveField("contractor", v)}
              extraAction={recognizedSupplier && !readOnly ? (
                <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={() => void addRecognizedSupplier()}>
                  В справочник
                </Button>
              ) : undefined}
            />
    </>
  );
  const docFileName = (url: string) => {
    try {
      return decodeURIComponent(url.split("/").pop() || "Документ").replace(/^\d+-/, "");
    } catch {
      return "Документ";
    }
  };
  // В блоке счёта показываем только финальную редакцию ЗРС, если она есть.
  const zrsDocs = documentUrls.filter((url) => /-ZRS\.pdf$/i.test(docFileName(url)));
  const invoiceDocs = zrsDocs.length ? [zrsDocs[zrsDocs.length - 1]] : documentUrls.slice(-1);
  const mainInvoiceDoc = invoiceDocs[0];
  const displayInvoiceName = `${(request.description || request.request_number || "Заявка").replace(/[\\/:*?"<>|\r\n\t]/g, "").replace(/\s+/g, " ").trim() || "Заявка"}-ZRS.pdf`;
  const resendZrsToMax = async (url: string) => {
    try {
      const { error } = await supabase.functions.invoke("notify-telegram", { body: { action: "send_zrs_document", organization_id: request.organization_id, document_url: url, file_name: docFileName(url), caption: `📋 ЗРС — Счёт\n\nЗаявка: ${request.description || request.request_number}` } });
      if (error) throw error;
      toast({ title: "Отправлено в Макс", description: "ЗРС повторно отправлена в группу поставок" });
    } catch { toast({ title: "Ошибка отправки", description: "Не удалось отправить ЗРС в Макс", variant: "destructive" }); }
  };
  const sendRequestToMax = async () => {
    try {
      const { data: textData, error: textError } = await supabase.rpc("build_request_message_by_id", { _request_id: request.id });
      if (textError) throw textError;
      const { data, error } = await supabase.functions.invoke("max-direct-send", {
        body: { chat_id: "-75086506652357", text: String(textData || ""), organization_id: request.organization_id, mode: "auto", request_id: request.id, document_url: mainInvoiceDoc || undefined, file_name: mainInvoiceDoc ? docFileName(mainInvoiceDoc) : undefined },
      });
      if (error || !(data?.ok || data?.delivered)) throw error || new Error("not delivered");
      toast({ title: "Отправлено в Макс", description: "Заявка повторно отправлена в группу поставок" });
    } catch {
      toast({ title: "Ошибка отправки", description: "Не удалось отправить заявку в Макс", variant: "destructive" });
    }
  };
  const invoiceBlock = (
    <div className="mt-2 border-t border-border pt-2">
      <div className="text-[13px] font-semibold text-muted-foreground">Файл счёта</div>
      {mainInvoiceDoc ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-[160px] flex-1 break-words text-sm" title={displayInvoiceName}>
              {displayInvoiceName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-[13px]"
              onClick={() => void openStoredFile(mainInvoiceDoc)}
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Открыть
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-2 text-[13px]"
              onClick={() => void downloadStoredFile(mainInvoiceDoc, displayInvoiceName)}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Скачать
            </Button>
            {docFileName(mainInvoiceDoc).toLowerCase().includes("zrs") && <Button type="button" variant="outline" size="sm" className="h-9 px-2 text-[13px]" onClick={() => void resendZrsToMax(mainInvoiceDoc)}>В Макс</Button>}
            <RequestDocumentDeleteButton request={request} url={mainInvoiceDoc} readOnly={readOnly} onDeleted={applyLocalRequestPatch} />
          </div>
          {invoiceDocs.length > 1 && (
            <div className="mt-1.5 space-y-1">
              {invoiceDocs.slice(1).map((url) => (
                <div key={url} className="flex flex-wrap items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground" title={docFileName(url)}>
                    {docFileName(url)}
                  </span>
                  <button
                    type="button"
                    className="min-h-9 shrink-0 px-1 text-[13px] text-primary"
                    onClick={() => void downloadStoredFile(url, docFileName(url))}
                  >
                    Скачать
                  </button>
                  {docFileName(url).toLowerCase().includes("zrs") && <Button type="button" variant="outline" size="sm" className="h-9 px-2 text-[13px]" onClick={() => void resendZrsToMax(url)}>В Макс</Button>}
                  <RequestDocumentDeleteButton request={request} url={url} readOnly={readOnly} onDeleted={applyLocalRequestPatch} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">Файл счёта не прикреплён</span>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-2 text-[13px]"
              onClick={() => invoiceAttachRef.current?.click()}
            >
              <Paperclip className="mr-1 h-3.5 w-3.5" />
              Прикрепить
            </Button>
          )}
        </div>
      )}
      <input
        ref={invoiceAttachRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          if (files.length) void handleUpload(files);
        }}
      />
    </div>
  );
  const totalsBlock = (
    <div className="w-full min-w-0">
            <div className="mt-2 rounded bg-muted/60 px-3 py-2.5">
              <PanelField
                label="Товар"
                type="number"
                value={goods}
                display={<span className="font-numeric">{money(goods)} ₽</span>}
                readOnly={readOnly}
                alwaysEdit={editMode}
                onSave={(v) => saveField("amount", Number(v.replace(",", ".")) || 0)}
              />
              <PanelField
                label="Доставка"
                type="number"
                value={(request as any).amount_2 || 0}
                display={<span className="font-numeric">{money(extra)} ₽</span>}
                readOnly={readOnly}
                alwaysEdit={editMode}
                onSave={(v) => saveField("amount_2", Number(v.replace(",", ".")) || 0)}
              />
              <div className="mt-2 flex items-end justify-between border-t border-border pt-2">
                <span className="text-[0.8125rem] text-muted-foreground">Всего</span>
                <span className="font-numeric text-[1.375rem] font-semibold tracking-tight">{money(total)} ₽</span>
              </div>
            </div>
            {/* Оплата — отдельной строкой под блоком сумм */}
            <div className="mt-2 px-3">
              <RequestInlineField
                label="Факт оплаты, %"
                type="number"
                value={paid}
                display={
                  <span className={cn("font-numeric text-[0.9375rem] font-semibold", paid >= 100 ? "text-success" : paid > 0 ? "text-warning" : "text-destructive")}>
                    {paid} % — {paid >= 100 ? "оплачено полностью" : paid > 0 ? "оплачено частично" : "не оплачено"}
                  </span>
                }
                readOnly={readOnly}
                onEditingChange={(editing) => setActiveEditor(editing ? "payment" : null)}
                onSave={(v) => saveField("payment_percent", Math.min(100, Math.max(0, Number(v.replace(",", ".")) || 0)))}
              />
              {!readOnly && (
                <div className="relative -mt-12 flex flex-wrap items-center justify-end gap-1.5 pb-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-8 bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
                    onClick={async () => {
                      await saveField("payment_percent", 50);
                      setPendingPaymentPercent(50);
                      setStatusPromptOpen(true);
                    }}
                  >
                    {paid >= 50 && paid < 100 ? "Доплата 50%" : "Оплачено 50%"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={paid >= 100}
                    className="h-8 bg-success px-3 text-sm text-success-foreground hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={async () => {
                      await saveField("payment_percent", 100);
                      setPendingPaymentPercent(100);
                      setStatusPromptOpen(true);
                    }}
                  >
                    Оплачено 100%
                  </Button>
                </div>
              )}
            </div>
    </div>
  );

  const fieldsBlock = (
    <>
      <div className={cardClass}>
        <div className={cardTitleClass}>Финансы и счёт</div>
        {invoiceNumberField}
        <RequestInvoiceActions request={request} readOnly={readOnly} onUpdated={applyLocalRequestPatch} />
        {totalsBlock}
        {invoiceBlock}
      </div>
      {logisticsBlock}
      {peopleBlock}
    </>
  );

  const movementBlock = (
    <>
            <div className="mt-4">
              <div className="mb-3 text-[15px] font-semibold text-foreground">Движение</div>

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
                      <div className="text-sm leading-5">{m.title}</div>
                      <div className="font-numeric text-xs leading-4 text-muted-foreground">{m.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
    </>
  );
  const linkedTasksBlock = (
    <LinkedPlannerTasks
      requestId={request.id}
      organizationId={currentOrgId || request.organization_id}
      requestTitle={request.description ?? undefined}
      objectId={request.object_id ?? null}
      expectedDate={request.delivery_date ?? null}
    />
  );
  const itemsBlock = (
          <PanelItemsTable
            requestId={request.id}
            organizationId={currentOrgId}
            items={(items || []) as any}
            readOnly={readOnly}
            onRecognizeInvoice={readOnly ? undefined : () => invoiceInputRef.current?.click()}
            recognizing={isRecognizingInvoice}
            onTotalChange={(itemsTotal) => {
              if (!preserveInvoiceAmount && itemsTotal > 0 && Math.abs(itemsTotal - goods) > 0.009) {
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
            documentUrl={request.document_url}
            photoUrl={request.photo_url}
            readOnly={readOnly}
            uploads={uploads}
            onUpload={handleUpload}
            onDeleted={applyLocalRequestPatch}
          />
  );
  const historyBlock = (
          <div className="space-y-1">
            {(history || []).length === 0 && <div className="text-sm text-muted-foreground">Записей нет</div>}
            {(history || []).map((h: any) => (
              <div key={h.id} className="flex items-center justify-between gap-2 border-b border-border/70 py-1.5">
                <span className="min-w-0 break-words text-sm leading-5">{h.action}</span>
                <span className="font-numeric shrink-0 text-xs leading-4 text-muted-foreground">
                  {h.created_at ? format(new Date(h.created_at), "dd.MM.yy HH:mm") : ""}
                </span>
              </div>
            ))}
          </div>
  );
  const mobileDetailsClass = "group mt-3 w-full min-w-0 rounded-[16px] border border-border bg-card";
  const mobileSummaryClass = "flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-semibold text-foreground [&::-webkit-details-marker]:hidden";
  const MOBILE_PHASE_COLORS = ["#485B9B", "#905019", "#466637", "#24714E"];
  const mobileStage = getRequestRouteStage(request);
  const mobileArrival = request.actual_arrival_date || request.planned_delivery_date || request.delivery_date;
  const mobileBody = (
    <div className="w-full min-w-0 px-4 pb-4">
      <div className="mobile-phase-panel rounded-[16px] p-[14px]">
        <RequestInlineField
          label="Статус"
          type="select"
          hideLabel
          value={request.status}
          options={STATUSES.map((value) => ({ value, label: value }))}
          display={<span className="inline-flex items-center gap-2 text-[15px] font-semibold"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getStatusColor(request.status) }} />{request.status}</span>}
          readOnly={readOnly}
          onEditingChange={(editing) => setActiveEditor(editing ? "status" : null)}
          onSave={(value) => saveField("status", value)}
        />
        <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Этапы заявки">
          {REQUEST_ROUTE_LABELS.map((label, index) => {
            const reached = index < mobileStage || index === mobileStage && (index < 3 || isRequestDeliveryConfirmed(request));
            const color = MOBILE_PHASE_COLORS[index];
            return (
              <li key={label} className="relative flex min-w-0 flex-col items-center text-center" aria-current={index === mobileStage ? "step" : undefined}>
                {index > 0 && <span className="absolute right-1/2 top-[6px] h-px w-full bg-border" aria-hidden="true" />}
                <span className="relative h-3 w-3 rounded-full border-2" style={reached ? { backgroundColor: color, borderColor: color } : { borderColor: color, backgroundColor: "transparent" }} aria-hidden="true" />
                <span className={cn("mt-1 break-words text-[11px] leading-tight", reached ? "text-foreground font-medium" : "text-muted-foreground")}>{label}</span>
                <span className="sr-only">{reached ? "пройден" : "не пройден"}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 grid gap-1 border-t border-border pt-2 text-[14px]">
          <RequestInlineField
            label={request.actual_arrival_date ? "Приход (факт)" : "Приход (план)"}
            type="date"
            value={request.actual_arrival_date || request.delivery_date}
            display={<span className="font-numeric">{dt(mobileArrival) || "—"}</span>}
            readOnly={readOnly}
            onEditingChange={(editing) => setActiveEditor(editing ? "route-date" : null)}
            onSave={(v) => saveField(request.actual_arrival_date ? ("actual_arrival_date" as any) : "delivery_date", v)}
          />
          <RequestInlineField
            label="ТК"
            value={request.transport_company}
            readOnly={readOnly}
            onEditingChange={(editing) => setActiveEditor(editing ? "carrier" : null)}
            onSave={(v) => saveField("transport_company", v)}
          />
        </div>
      </div>
      <div className="mt-3 grid gap-1 px-1 text-[14px]">
        <RequestInlineField
          label="Приоритет"
          type="select"
          value={request.priority || "Планово"}
          options={PRIORITIES.map((value) => ({ value, label: value }))}
          display={<span style={{ color: getPriorityColor(request.priority || "Планово") }}>{request.priority || "Планово"}</span>}
          readOnly={readOnly}
          onEditingChange={(editing) => setActiveEditor(editing ? "priority" : null)}
          onSave={(value) => saveField("priority", value)}
        />
        <PanelField
          label="Исполнитель"
          type="select"
          options={executorOptions}
          value={request.executor}
          display={formatPersonName(request.executor)}
          readOnly={readOnly}
          alwaysEdit={editMode}
          onSave={(v) => saveField("executor", v)}
        />
      </div>
      <details className={mobileDetailsClass}>
        <summary className={mobileSummaryClass}>Счёт и оплата<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <div className="px-3 pb-3">
          {invoiceNumberField}
          <RequestInvoiceActions request={request} readOnly={readOnly} onUpdated={applyLocalRequestPatch} />
          {totalsBlock}
          {invoiceBlock}
          <div className="mt-3"><div className="mb-3 text-[15px] font-semibold text-foreground">Позиции</div>{itemsBlock}</div>
        </div>
      </details>
      <details className={mobileDetailsClass}>
        <summary className={mobileSummaryClass}>Логистика<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <div className="px-3 pb-3 [&>.request-side-card]:mt-0 [&>.request-side-card]:border-0 [&>.request-side-card]:px-1">
          {logisticsBlock}
          {peopleBlock}
          <div className="flex flex-wrap gap-2 px-1 pt-2"><RequestQrWorkflow key={request.id} request={request} qrEntry={qrEntry} receiptOpenSignal={receiptOpenSignal}/><RequestQrButton key={`qr-${request.id}`} request={request}/><TrustLetterButton requestIds={[request.id]} organizationId={request.organization_id}/></div>
          {movementBlock}
        </div>
      </details>
      <details className={mobileDetailsClass}>
        <summary className={mobileSummaryClass}>Документы<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <div className="px-3 pb-3">{docsBlock}<div className="mt-3"><div className="mb-3 text-[15px] font-semibold text-foreground">История</div>{historyBlock}</div></div>
      </details>
      <details className={mobileDetailsClass}>
        <summary className={mobileSummaryClass}>Задачи<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <div className="px-3 pb-3">{linkedTasksBlock}</div>
      </details>
    </div>
  );
  const wideFullscreen = isFullscreen && viewportWide;
  const containerClass = isFullscreen ? "mx-auto w-[min(1440px,100%-96px)]" : undefined;
  const columnClass = "flex h-full min-w-0 flex-col rounded-[16px] border border-border bg-card p-5";
  const sectionTitleClass = "mb-3 text-[15px] font-semibold text-foreground";


  const content = (
    <aside
      className={cn(
        "request-side-panel requests-registry mobile-brand flex min-h-0 flex-col border-l border-border bg-card",
        assistantOpen && "max-sm:!fixed max-sm:!inset-0 max-sm:!z-[220] max-sm:!h-[100dvh] max-sm:!w-screen",
        dragActive && "ring-2 ring-inset ring-primary",
        isFullscreen
          ? cn(
              "request-fullscreen fixed inset-0 h-[100vh] w-[100vw] border-0 overflow-hidden bg-background",
              editorOpen ? "z-[40]" : "z-[200]"
            )

          : asOverlay
            ? "fixed inset-y-0 right-0 z-50 h-[100dvh] max-w-[100vw] max-md:!w-screen max-md:!inset-x-0 max-md:border-l-0 overflow-hidden shadow-panel motion-reduce:animate-none"
            : "h-full w-full overflow-hidden"
      )}
      style={
        isFullscreen
          ? undefined
          : asOverlay
            ? {
                width: `min(${panelWidth}px, 92vw)`,
                transition: "width var(--dur) var(--ease), transform 300ms var(--ease)",
                animation: "slide-in-right var(--dur) var(--ease)",
              }
            : { transition: "transform 300ms var(--ease)" }
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
      <input
        ref={invoiceInputRef}
        type="file"
        hidden
        accept=".pdf,.xlsx,.xls,.csv,.ods,image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleRecognizeInvoice(file);
        }}
      />
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
      {!assistantOpen && <>
      <div className="flex-none px-4 pt-3 md:hidden">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 h-10 gap-1 px-2 text-sm text-primary" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />Назад
        </Button>
      </div>
      <div className={cn("flex flex-none items-start gap-2 px-4 pt-3", containerClass)}>
        <RequestInlineField
          label="Название заявки"
          type="textarea"
          hideLabel
          value={request.description}
          display={<span className="request-side-panel__title">{request.description || "Заявка"}</span>}
          readOnly={readOnly}
          onEditingChange={(editing) => setActiveEditor(editing ? "description" : null)}
          onSave={(value) => saveField("description", value.trim())}
        />
        <div className="flex shrink-0 items-center gap-0.5 max-md:hidden">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevious} disabled={!hasPrevious} aria-label="Предыдущая заявка">
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onNext} disabled={!hasNext} aria-label="Следующая заявка">
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLabelOpen(true)} aria-label="Этикетка" title="Этикетка">
            <Tag className="h-3.5 w-3.5" />
          </Button>
          <LabelPrintDialog
            open={labelOpen}
            onOpenChange={setLabelOpen}
            description={request.description || null}
            applicant={request.applicant || null}
          />
          {isFullscreen ? (
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-sm" onClick={() => setIsFullscreen(false)} title="Вернуться к реестру">
              <Minimize2 className="h-3.5 w-3.5" />
              Свернуть к реестру
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => setIsFullscreen(true)} aria-label="Развернуть на весь экран" title="Развернуть на весь экран">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Закрыть">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={cn("request-card-comment-block px-4 pt-1", containerClass)}>
        <RequestInlineField
          label="Комментарий"
          type="textarea"
          value={request.comments}
          display={<span className="request-card-comment">{request.comments || "—"}</span>}
          readOnly={readOnly}
          onEditingChange={(editing) => setActiveEditor(editing ? "comments" : null)}
          onSave={(value) => saveField("comments", value)}
        />
      </div>

      <div className={cn("px-4 pt-2 max-md:hidden", containerClass)}>
        <RequestRoute
          request={request}
          readOnly={readOnly}
          onEditingChange={(editing) => setActiveEditor(editing ? "route-date" : null)}
          onDeliverySave={(value) => saveField("delivery_date", value)}
        />
      </div>

      <div className={cn("request-card-meta flex-none gap-2 max-md:!hidden px-4 pt-1.5 text-[0.8125rem] text-muted-foreground font-numeric", containerClass)}>
        <RequestInlineField
          label="Статус"
          type="select"
          hideLabel
          className="request-card-meta-field"
          value={request.status}
          options={STATUSES.map((value) => ({ value, label: value }))}
          display={<span className="request-card-status"><i style={{ backgroundColor: getStatusColor(request.status) }} />{request.status}</span>}
          readOnly={readOnly}
          onEditingChange={(editing) => setActiveEditor(editing ? "status" : null)}
          onSave={(value) => saveField("status", value)}
        />
        <RequestInlineField
          label="Приоритет"
          type="select"
          hideLabel
          className="request-card-meta-field"
          value={request.priority || "Планово"}
          options={PRIORITIES.map((value) => ({ value, label: value }))}
          display={<span style={{ color: getPriorityColor(request.priority || "Планово") }}>{request.priority || "Планово"}</span>}
          readOnly={readOnly}
          onEditingChange={(editing) => setActiveEditor(editing ? "priority" : null)}
          onSave={(value) => saveField("priority", value)}
        />
        <span className="hidden font-numeric md:inline" title={request.request_number || undefined}>{formatRequestPublicNumber(request) ?? request.request_number}</span>
        <span className="font-numeric">{dt(request.request_date) ?? "—"}</span>
        {position && requestCount ? <span className="ml-auto font-numeric">{position} / {requestCount}</span> : null}
        {savingField && savingField !== "description" && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      {!assistantOpen && !isPhone && <div className="flex flex-none flex-wrap gap-2 px-4 py-2"><RequestQrWorkflow key={request.id} request={request} qrEntry={qrEntry} receiptOpenSignal={receiptOpenSignal}/><RequestQrButton key={`qr-${request.id}`} request={request}/><TrustLetterButton requestIds={[request.id]} organizationId={request.organization_id}/></div>}
      {/* Body */}
      </>}
      {assistantOpen ? <div className="min-h-0 flex-1"><ClaudeRequestAssistant key={request.id} requestId={request.id} requestNumber={request.request_number} organizationId={request.organization_id} onBack={() => setAssistantOpen(false)}/></div> : <>
      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain py-3", isFullscreen ? "px-0" : "px-4")}>
        {isPhone ? mobileBody : wideFullscreen ? (
          <div
            className="mx-auto grid h-full w-[min(1440px,100%-96px)] items-stretch gap-6"
            style={{ gridTemplateColumns: "440px minmax(0, 1fr) 400px" }}
          >
            <div className={cn(columnClass, "overflow-y-auto")}>
              {fieldsBlock}
            </div>
            <div className={cn(columnClass, "overflow-y-auto")}>
              <div className={sectionTitleClass}>Позиции</div>
              {itemsBlock}
            </div>
            <div className={cn(columnClass, "gap-5 overflow-y-auto")}>
              {docsBlock}
              <div>{linkedTasksBlock}</div>
              <div>{movementBlock}</div>
              <div>
                <div className={sectionTitleClass}>История</div>
                {historyBlock}
              </div>
            </div>
          </div>
        ) : (
          <div className={cn("w-full min-w-0", containerClass, isFullscreen && "px-0")}>
            {(
              <>
                {fieldsBlock}
                {isFullscreen ? (
                  <div className={cardClass}>
                    <div className={sectionTitleClass}>Позиции</div>
                    {itemsBlock}
                  </div>
                ) : (
                  <>
                  <button
                    type="button"
                    onClick={() => setPositionsOpen((v) => !v)}
                    className="mt-3 flex min-h-9 w-full items-center justify-between rounded border border-border px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <span>Позиции: {items?.length || 0}</span>
                    <span className="text-primary">{positionsOpen ? "Скрыть" : "Показать"}</span>
                  </button>
                  {positionsOpen && <div className={cardClass}>{itemsBlock}</div>}
                  </>
                )}
                <details className={cardClass}>
                  <summary className="cursor-pointer list-none font-semibold">Задачи по заявке</summary>
                  <div className="mt-3">{linkedTasksBlock}</div>
                </details>
                {movementBlock}
                <div className={cardClass}>{docsBlock}</div>
                <div className={cardClass}><div className={sectionTitleClass}>История</div>{historyBlock}</div>
              </>
            )}
          </div>
        )}

      </div>


      {/* Footer */}
      <div className="flex-none border-t border-border bg-card px-4 py-2.5">
        <div className={cn("flex flex-wrap items-center gap-3", containerClass)}>
        {editMode ? (
          <>
            <Button
              size="sm"
              className="h-9 gap-1 bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                (document.activeElement as HTMLElement | null)?.blur();
                setEditMode(false);
                setEditDirty(false);
              }}
            >
              Сохранить
            </Button>
            <Button size="sm" variant="outline" className="h-9 px-3 text-sm" onClick={() => exitEditMode(true)}>
              Отмена
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="h-9 gap-1 bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
            disabled={readOnly}
            onClick={(event) => {
              event.currentTarget.blur();
              setEditMode(false);
              setEditDirty(false);
              setEditingRequest(request);
              setEditorOpen(true);
              onClose();
            }}
          >
            Редактировать
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1 px-3 text-sm"
          disabled={readOnly || request.status === "Доставлено"}
          onClick={() => {
            if (!request.shipment_date) {
              toast({ title: "Нельзя отметить приход", description: "Сначала укажите дату выхода (отгрузки)", variant: "destructive" });
              return;
            }
            const today = new Date().toISOString().slice(0, 10);
            void saveField("actual_arrival_date" as any, today);
            void (async () => {
              const { error } = await supabase.from("requests").update({ status: "Доставлено", actual_arrival_date: today } as any).eq("id", request.id);
              if (error) {
                toast({ title: "Не удалось отметить приход", description: error.message, variant: "destructive" });
                return;
              }
              setReceiptOpenSignal(n => n + 1);
              queryClient.invalidateQueries({ queryKey: ["requests"] });
            })();
          }}
        >
          <PackageCheck className="h-3.5 w-3.5" />
          Отметить приход
        </Button>


        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="ml-auto h-8 w-8" aria-label="Ещё">
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
            <DropdownMenuItem onClick={() => sendRequestToAppleReminders(request as any)}>
              В Напоминания Apple
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void sendRequestToMax()}>
              Повторно отправить в Макс
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      </>}
    </aside>
  );

  const panelBody = open ? content : null;

  const handleStatusFromPrompt = async (status: string) => {
    setStatusPromptOpen(false);
    if (status && status !== request?.status) {
      await saveField("status", status);
    }
    setPendingPaymentPercent(null);
  };

  return (
    <>
      {asOverlay ? createPortal(panelBody, document.body) : panelBody}
      <EditRequestDialog
        request={request as any}
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) {
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.invalidateQueries({ queryKey: ["request", request.id] });
            setEditingRequest(null);
          }
        }}
      />
      <Dialog open={statusPromptOpen} onOpenChange={setStatusPromptOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Оплата обновлена</DialogTitle>
            <DialogDescription>
              {pendingPaymentPercent === 100
                ? "Заявка оплачена полностью. Сменить статус?"
                : "Заявка оплачена частично. Сменить статус?"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Button
              variant="outline"
              className="justify-start px-3 text-left"
              onClick={() => handleStatusFromPrompt("В работе")}
            >
              <span className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor("В работе") }} />
              В работе
            </Button>
            <Button
              variant="outline"
              className="justify-start px-3 text-left"
              onClick={() => handleStatusFromPrompt("Готов к отгрузке")}
            >
              <span
                className="mr-2 h-2 w-2 rounded-full"
                style={{ backgroundColor: getStatusColor("Готов к отгрузке") }}
              />
              Готов к отгрузке
            </Button>
            <Button
              variant="ghost"
              className="justify-start px-3 text-left text-muted-foreground"
              onClick={() => handleStatusFromPrompt(request?.status || "")}
            >
              Не менять статус
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
