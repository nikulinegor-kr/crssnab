import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ExternalLink, Pencil, Building2, User, Truck, Calendar, FileText, Download, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Request } from "@/hooks/useRequests";
import { getStatusColor, getPriorityColor } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { SignedImage } from "@/components/SignedImage";
import { openStoredFile } from "@/lib/storageUrl";

interface RequestQuickViewProps {
  requestId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (request: Request) => void;
  formOpen?: boolean;
}

const AUTO_CLOSE_MS = 7000;

export const RequestQuickView = memo(function RequestQuickView({
  requestId,
  open,
  onClose,
  onEdit,
  formOpen = false,
}: RequestQuickViewProps) {
  const navigate = useNavigate();
  const [request, setRequest] = useState<Request | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [interacting, setInteracting] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      return;
    }
    let cancelled = false;
    setRequest(null);
    supabase.from("requests").select("*").eq("id", requestId).single()
      .then(({ data }) => {
        if (!cancelled && data) setRequest(data as Request);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    if (!open) return;
    setPinned(false);
    setHovered(false);
    setFocused(false);
    setInteracting(false);
  }, [open, requestId]);

  useEffect(() => {
    if (!open || pinned || hovered || focused || interacting || formOpen) return;
    const timer = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open, pinned, hovered, focused, interacting, formOpen, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !formOpen) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, formOpen]);

  if (!open || !request) return null;

  const formatCurrency = (value: number) =>
    `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    try {
      return format(new Date(value), "dd.MM.yyyy");
    } catch {
      return value;
    }
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
  const totalAmount = Number(request.amount || 0)
    + Number((request as Request & { amount_2?: number }).amount_2 || 0)
    + Number((request as Request & { amount_3?: number }).amount_3 || 0);
  const paymentPercent = Number(request.payment_percent || 0);
  const paymentLabel = paymentPercent >= 100
    ? "Оплачено"
    : paymentPercent > 0
      ? `Частично оплачено · ${paymentPercent}%`
      : "Не оплачено";

  return (
    <aside
      className="request-quick-view"
      role="dialog"
      aria-modal="false"
      aria-label={`Карточка заявки: ${request.description}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setInteracting(false);
      }}
      onPointerDown={() => setInteracting(true)}
      onPointerUp={() => setInteracting(false)}
      onPointerCancel={() => setInteracting(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="request-quick-view__header">
        <h3 className="request-quick-view__title">{request.description || "Заявка"}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9 shrink-0", pinned && "bg-primary/10 text-primary")}
          onClick={() => setPinned((value) => !value)}
          aria-pressed={pinned}
          aria-label={pinned ? "Открепить карточку" : "Закрепить карточку"}
          title={pinned ? "Открепить" : "Закрепить: не закрывать автоматически"}
        >
          <Pin className={cn("h-4 w-4", pinned && "fill-current")} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onClose}
          aria-label="Закрыть карточку"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 px-[18px] pb-3 pt-4">
        <Badge variant="outline" className="gap-2 px-2.5 py-1 text-xs font-medium">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(request.status) }} />
          {request.status}
        </Badge>
        <Badge
          variant="outline"
          className="gap-2 px-2.5 py-1 text-xs font-medium"
          style={{ borderColor: getPriorityColor(request.priority || "Планово") }}
        >
          {request.priority || "Планово"}
        </Badge>
      </div>

      <div className="request-quick-view__summary">
        <div className="request-quick-view__metric">
          <span>Сумма</span>
          <strong>{totalAmount > 0 ? formatCurrency(totalAmount) : "—"}</strong>
        </div>
        <div className="request-quick-view__metric">
          <span>Приход</span>
          <strong>{formatDate(request.delivery_date)}</strong>
        </div>
      </div>

      <div className="request-quick-view__body">
        <section className="request-quick-view__section space-y-3" aria-label="Обзор заявки">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Обзор</h4>
          <div className="flex items-start gap-2 text-sm">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Контрагент</div>
              <div className="break-words font-medium">{request.contractor || "—"}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <span className={cn(
              "mt-1.5 ml-1.5 h-2 w-2 shrink-0 rounded-full",
              paymentPercent >= 100 ? "bg-success" : paymentPercent > 0 ? "bg-warning" : "bg-destructive",
            )} />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Оплата</div>
              <div className="break-words font-medium">{paymentLabel}</div>
            </div>
          </div>
          {(request.applicant || request.executor) && (
            <div className="flex items-start gap-2 text-sm">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 break-words">
                {request.applicant && <div>Заявитель: {request.applicant}</div>}
                {request.executor && <div>Исполнитель: {request.executor}</div>}
              </div>
            </div>
          )}
          {(request.transport_company || request.shipment_date) && (
            <div className="flex items-start gap-2 text-sm">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 break-words">
                {request.transport_company && <div>{request.transport_company}</div>}
                {request.shipment_date && <div>Отгрузка: {formatDate(request.shipment_date)}</div>}
              </div>
            </div>
          )}
          {request.delivery_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Приход: {formatDate(request.delivery_date)}</span>
            </div>
          )}
          {request.comments && (
            <p className="break-words text-sm text-muted-foreground">«{request.comments}»</p>
          )}
        </section>

        {totalFiles > 0 && (
          <section className="request-quick-view__section mt-4 space-y-2" aria-label="Документы">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Документы ({totalFiles})
            </p>
            {allPhotos.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allPhotos.slice(0, 4).map((url, index) => (
                  <div key={url} className="h-12 w-12 overflow-hidden rounded-lg border border-border">
                    <SignedImage src={url} alt={`Фото ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
                {allPhotos.length > 4 && (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted text-xs text-muted-foreground">
                    +{allPhotos.length - 4}
                  </div>
                )}
              </div>
            )}
            {allDocuments.slice(0, 3).map((url, index) => (
              <div key={url} className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">Документ {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => openStoredFile(url)}
                  aria-label={`Открыть документ ${index + 1}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </section>
        )}
      </div>

      <div className="request-quick-view__footer flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-2"
          onClick={() => {
            onClose();
            navigate(`/requests/${request.id}`);
          }}
        >
          <ExternalLink className="h-4 w-4" />
          Открыть
        </Button>
        <Button
          type="button"
          className="h-10 flex-1 gap-2"
          onClick={() => onEdit?.(request)}
        >
          <Pencil className="h-4 w-4" />
          Редактировать
        </Button>
      </div>
    </aside>
  );
});
