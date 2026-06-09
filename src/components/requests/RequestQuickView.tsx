import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ExternalLink, Pencil, Building2, Flag, CheckCircle, User, Truck, Calendar, RussianRuble, FileText, FileImage, Download } from "lucide-react";
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
}

export const RequestQuickView = memo(function RequestQuickView({ requestId, open, onClose, onEdit }: RequestQuickViewProps) {
  const navigate = useNavigate();
  const [request, setRequest] = useState<Request | null>(null);

  useEffect(() => {
    if (!requestId) { setRequest(null); return; }
    let cancelled = false;
    supabase.from("requests").select("*").eq("id", requestId).single()
      .then(({ data }) => { if (!cancelled && data) setRequest(data as Request); });
    return () => { cancelled = true; };
  }, [requestId]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || !request) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("ru-RU").format(val) + " ₽";

  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd.MM.yyyy"); } catch { return d; }
  };

  const allPhotos: string[] = [
    ...(request.photo_urls || []),
    ...(request.photo_url && !request.photo_urls?.includes(request.photo_url) ? [request.photo_url] : [])
  ].filter(Boolean);

  const allDocuments: string[] = [
    ...(request.document_urls || []),
    ...(request.document_url && !request.document_urls?.includes(request.document_url) ? [request.document_url] : [])
  ].filter(Boolean);

  const totalFiles = allPhotos.length + allDocuments.length;

  return (
    <div
      className="sticky top-20 shrink-0 z-30 w-[360px] rounded-xl border border-border bg-card shadow-lg"
      style={{ height: "auto", maxHeight: 560, overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
        <h3 className="text-sm font-semibold text-foreground truncate pr-2">
          {request.description?.slice(0, 50) || "Заявка"}
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2 text-sm overflow-y-auto flex-1 min-h-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="text-[10px] px-2 py-0.5" style={{ backgroundColor: getStatusColor(request.status), color: "#fff" }}>
            {request.status}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-2 py-0.5"
            style={{ borderColor: getPriorityColor(request.priority || "Планово"), color: getPriorityColor(request.priority || "Планово") }}>
            {request.priority || "Планово"}
          </Badge>
        </div>

        {request.contractor && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{request.contractor}</span>
          </div>
        )}
        {request.applicant && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{request.applicant}</span>
          </div>
        )}
        {request.executor && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{request.executor}</span>
          </div>
        )}

        {/* Logistics */}
        {(request.transport_company || request.shipment_date || request.delivery_date || (request.amount && request.amount > 0)) && (
          <div className="border-t border-border/30 pt-2 space-y-1.5">
            {request.transport_company && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">ТК: {request.transport_company}</span>
              </div>
            )}
            {request.shipment_date && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Отгрузка: {formatDate(request.shipment_date)}</span>
              </div>
            )}
            {request.delivery_date && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Приход: {formatDate(request.delivery_date)}</span>
              </div>
            )}
            {request.amount && request.amount > 0 && (
              <div className="flex items-center gap-2 text-xs font-medium">
                <RussianRuble className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{formatCurrency(Number(request.amount))}</span>
              </div>
            )}
          </div>
        )}

        {request.comments && (
          <p className="text-xs text-muted-foreground italic line-clamp-2 border-t border-border/30 pt-2">"{request.comments}"</p>
        )}

        {/* Documents section */}
        {totalFiles > 0 && (
          <div className="border-t border-border/30 pt-2 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Документы ({totalFiles})
            </p>
            {allPhotos.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {allPhotos.slice(0, 4).map((url, i) => (
                  <div key={i} className="w-12 h-12 rounded border border-border overflow-hidden">
                    <SignedImage src={url} alt={`Фото ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
                {allPhotos.length > 4 && (
                  <div className="w-12 h-12 rounded border border-border flex items-center justify-center bg-muted text-xs text-muted-foreground">
                    +{allPhotos.length - 4}
                  </div>
                )}
              </div>
            )}
            {allDocuments.length > 0 && (
              <div className="space-y-1">
                {allDocuments.slice(0, 3).map((url, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3 shrink-0 text-primary" />
                    <span className="truncate flex-1">Документ {i + 1}</span>
                    <button type="button" onClick={() => openStoredFile(url)} className="shrink-0 hover:text-primary">
                      <Download className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {allDocuments.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">и ещё {allDocuments.length - 3}...</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/50 flex gap-2 shrink-0">
        <Button size="sm" className="flex-1 gap-1.5 text-xs h-8"
          onClick={() => { onClose(); navigate(`/requests/${request.id}`); }}>
          <ExternalLink className="h-3.5 w-3.5" /> Открыть
        </Button>
        <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs h-8"
          onClick={() => { onClose(); onEdit?.(request); }}>
          <Pencil className="h-3.5 w-3.5" /> Редактировать
        </Button>
      </div>
    </div>
  );
});
