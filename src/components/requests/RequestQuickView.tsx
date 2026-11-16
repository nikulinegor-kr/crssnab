import { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ExternalLink, Pencil, Building2, User, FileText, Download, Pin, ClipboardList, History, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Request } from "@/hooks/useRequests";
import { getPriorityColor, getStatusColor, PRIORITIES } from "@/hooks/useRequestsFilters";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { SignedImage } from "@/components/SignedImage";
import { openStoredFile } from "@/lib/storageUrl";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrgStatuses } from "@/hooks/useOrgStatuses";
import { deliveryDatesError } from "@/lib/requestDeliveryValidation";
import { getRequestObjectLabel } from "@/lib/requestCard";
import { useRequestCardTimer } from "@/hooks/useRequestCardTimer";
import { RequestInlineField } from "./RequestInlineField";
import { RequestRoute } from "./RequestRoute";

interface RequestQuickViewProps {
  requestId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (request: Request) => void;
  onOpenSection?: (request: Request, section: "docs" | "tasks" | "history") => void;
  formOpen?: boolean;
}

type QuickRequest = Request & { object_name?: string | null };

export const RequestQuickView = memo(function RequestQuickView({
  requestId,
  open,
  onClose,
  onEdit,
  onOpenSection,
  formOpen = false,
}: RequestQuickViewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEdit } = useUserRole();
  const statuses = useOrgStatuses();
  const [request, setRequest] = useState<QuickRequest | null>(null);
  const [pinned, setPinned] = useState(false);
  const [activeEditor, setActiveEditor] = useState<string | null>(null);
  const { remainingSeconds, restart } = useRequestCardTimer({
    open,
    resetKey: requestId,
    pinned,
    paused: Boolean(activeEditor) || formOpen,
    onClose,
  });

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      return;
    }
    let cancelled = false;
    setRequest(null);
    void supabase.from("requests").select("*, request_objects(id, name)").eq("id", requestId).single()
      .then(async ({ data, error }) => {
        if (cancelled || error || !data) return;
        let contractor = data.contractor;
        if (contractor && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(contractor)) {
          const { data: supplier } = await supabase.from("suppliers").select("name").eq("id", contractor).maybeSingle();
          if (supplier?.name) contractor = supplier.name;
        }
        if (!cancelled) setRequest({ ...data, contractor, object_name: (data as any).request_objects?.name || null } as QuickRequest);
      });
    return () => { cancelled = true; };
  }, [requestId]);

  useEffect(() => {
    if (!open) return;
    setPinned(false);
    setActiveEditor(null);
  }, [open, requestId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !formOpen && !activeEditor) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, formOpen, activeEditor]);

  const saveField = useCallback(async (field: string, value: string) => {
    if (!request || !canEdit) return;
    if (field === "status" && value === "Доставлено") {
      const error = deliveryDatesError(request);
      if (error) {
        toast({ title: "Нельзя поставить «Доставлено»", description: error, variant: "destructive" });
        return;
      }
    }
    let next: string | number | null = value;
    if (field === "payment_percent") next = Math.min(100, Math.max(0, Number(value) || 0));
    if (next === "") next = null;
    const update: Record<string, string | number | null> = { [field]: next };
    if (field === "payment_percent") {
      update.payment_status = Number(next) >= 100 ? "Оплачено" : Number(next) > 0 ? "Частично оплачено" : "Не оплачено";
    }
    const previous = request;
    const optimistic = { ...request, ...update };
    setRequest(optimistic);
    queryClient.setQueriesData({ queryKey: ["requests"] }, (old: any) =>
      Array.isArray(old) ? old.map((row: any) => row?.id === request.id ? { ...row, ...update } : row) : old
    );
    try {
      const { error } = await supabase.from("requests").update(update).eq("id", request.id);
      if (error) throw error;
      toast({ title: "Сохранено" });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
    } catch (error: any) {
      setRequest(previous);
      queryClient.setQueriesData({ queryKey: ["requests"] }, (old: any) =>
        Array.isArray(old) ? old.map((row: any) => row?.id === request.id ? previous : row) : old
      );
      toast({ title: "Не удалось сохранить", description: error?.message || "Значение осталось прежним", variant: "destructive" });
      throw error;
    }
  }, [canEdit, queryClient, request, toast]);

  if (!open || !request) return null;

  const formatCurrency = (value: number) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    try { return format(new Date(value), "dd.MM.yyyy"); } catch { return value; }
  };
  const allPhotos: string[] = [
    ...(request.photo_urls || []),
    ...(request.photo_url && !request.photo_urls?.includes(request.photo_url) ? [request.photo_url] : []),
  ].filter(Boolean);
  const allDocuments: string[] = [
    ...(request.document_urls || []),
    ...(request.document_url && !request.document_urls?.includes(request.document_url) ? [request.document_url] : []),
  ].filter(Boolean);
  const totalFiles = allPhotos.length + allDocuments.length;
  const totalAmount = Number(request.amount || 0) + Number((request as any).amount_2 || 0) + Number((request as any).amount_3 || 0);
  const paymentPercent = Number(request.payment_percent || 0);
  const paymentLabel = paymentPercent >= 100 ? "Оплачено" : paymentPercent > 0 ? `Частично оплачено · ${paymentPercent}%` : "Не оплачено";
  const objectLabel = getRequestObjectLabel(request.object_id, request.object_name);
  const editorProps = (field: string) => ({
    readOnly: !canEdit,
    onEditingChange: (editing: boolean) => setActiveEditor(editing ? field : null),
  });

  return (
    <aside
      className="request-quick-view"
      role="dialog"
      aria-modal="false"
      aria-label={`Карточка заявки: ${request.description}`}
      onPointerDownCapture={restart}
      onKeyDownCapture={restart}
      onWheel={restart}
      onTouchStart={restart}
      onScrollCapture={restart}
    >
      <div className="request-quick-view__header">
        <RequestInlineField
          label="Название заявки"
          value={request.description}
          hideLabel
          display={<span className="request-quick-view__title">{request.description || "Заявка"}</span>}
          onSave={(value) => saveField("description", value)}
          {...editorProps("description")}
        />
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setPinned((value) => !value)} aria-pressed={pinned} aria-label={pinned ? "Открепить карточку" : "Закрепить карточку"}>
          <Pin className={pinned ? "h-4 w-4 fill-current text-primary" : "h-4 w-4"} />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClose} aria-label="Закрыть карточку"><X className="h-4 w-4" /></Button>
      </div>

      <div className="request-card-timer" role="timer" aria-live="off">
        {pinned ? "Карточка закреплена" : activeEditor || formOpen ? "Отсчёт на паузе во время редактирования" : `Закроется через ${remainingSeconds} с`}
      </div>

      <div className="request-quick-view__body">
        <RequestRoute request={request} onDeliverySave={(value) => saveField("delivery_date", value)} {...editorProps("route-date")} />

        <section className="request-quick-view__section" aria-label="Статус и приоритет">
          <div className="request-card-two-columns">
            <RequestInlineField label="Статус" type="select" value={request.status} options={statuses.map((value) => ({ value, label: value }))} display={<span className="request-card-status"><i style={{ backgroundColor: getStatusColor(request.status) }} />{request.status}</span>} onSave={(value) => saveField("status", value)} {...editorProps("status")} />
            <RequestInlineField label="Приоритет" type="select" value={request.priority} options={PRIORITIES.map((value) => ({ value, label: value }))} display={<span style={{ color: getPriorityColor(request.priority || "Планово") }}>{request.priority || "Планово"}</span>} onSave={(value) => saveField("priority", value)} {...editorProps("priority")} />
          </div>
        </section>

        <section className="request-quick-view__section" aria-label="Объект и контрагент">
          <div className="request-card-object"><Building2 className="h-4 w-4 shrink-0 text-primary" /><div><span>Объект</span><strong>{objectLabel}</strong></div></div>
          <div className="request-card-kv"><span>Контрагент</span><strong>{request.contractor || "—"}</strong></div>
          {(request.applicant || request.executor) && <div className="request-card-person"><User className="h-4 w-4 shrink-0" /><span>{[request.applicant && `Заявитель: ${request.applicant}`, request.executor && `Исполнитель: ${request.executor}`].filter(Boolean).join(" · ")}</span></div>}
        </section>

        <section className="request-quick-view__section" aria-label="Сумма и оплата">
          <div className="request-quick-view__summary">
            <div className="request-quick-view__metric"><span>Сумма</span><strong>{totalAmount > 0 ? formatCurrency(totalAmount) : "—"}</strong></div>
            <div className="request-quick-view__metric"><span>Оплата</span><strong>{paymentLabel}</strong></div>
          </div>
          <RequestInlineField label="Факт оплаты, %" type="number" value={paymentPercent} onSave={(value) => saveField("payment_percent", value)} {...editorProps("payment")} />
        </section>

        <section className="request-quick-view__section" aria-label="Логистика">
          <RequestInlineField label="Транспортная компания" value={request.transport_company} onSave={(value) => saveField("transport_company", value)} {...editorProps("carrier")} />
          <RequestInlineField label="Дата отгрузки" type="date" value={request.shipment_date} display={formatDate(request.shipment_date)} onSave={(value) => saveField("shipment_date", value)} {...editorProps("shipment")} />
          <RequestInlineField label="Дата доставки (приход)" type="date" value={request.delivery_date} display={formatDate(request.delivery_date)} onSave={(value) => saveField("delivery_date", value)} {...editorProps("delivery")} />
        </section>

        <section className="request-quick-view__section" aria-label="Комментарий">
          <RequestInlineField label="Комментарий" type="textarea" value={request.comments} display={<span className="request-card-comment">{request.comments || "—"}</span>} onSave={(value) => saveField("comments", value)} {...editorProps("comments")} />
        </section>

        {totalFiles > 0 && (
          <section className="request-quick-view__section" aria-label="Документы">
            <p className="request-card-section-title"><FileText className="h-3.5 w-3.5" />Документы ({totalFiles})</p>
            {allPhotos.length > 0 && <div className="flex flex-wrap gap-1.5">{allPhotos.slice(0, 4).map((url, index) => <div key={url} className="h-12 w-12 overflow-hidden rounded-lg border border-border"><SignedImage src={url} alt={`Фото ${index + 1}`} className="h-full w-full object-cover" /></div>)}</div>}
            {allDocuments.slice(0, 3).map((url, index) => <div key={url} className="request-card-document"><FileText className="h-3.5 w-3.5 shrink-0 text-primary" /><span>Документ {index + 1}</span><Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openStoredFile(url)} aria-label={`Открыть документ ${index + 1}`}><Download className="h-3.5 w-3.5" /></Button></div>)}
          </section>
        )}
      </div>

      <div className="request-card-section-links" aria-label="Разделы заявки">
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenSection?.(request, "docs")}><Paperclip />Документы</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenSection?.(request, "tasks")}><ClipboardList />Задачи</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenSection?.(request, "history")}><History />История</Button>
      </div>
      <div className="request-quick-view__footer">
        <Button type="button" variant="outline" className="h-10 gap-2" onClick={() => { onClose(); navigate(`/requests/${request.id}`); }}><ExternalLink className="h-4 w-4" />Открыть</Button>
        <Button type="button" className="h-10 flex-1 gap-2" onClick={() => onEdit?.(request)}><Pencil className="h-4 w-4" />Редактировать</Button>
      </div>
    </aside>
  );
});
