import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ExternalLink, Pencil, FileText, User, Building2, Flag, CheckCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Request } from "@/hooks/useRequests";
import { getStatusColor, getPriorityColor } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface RequestQuickViewProps {
  requestId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (request: Request) => void;
}

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
    <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || <span className="text-muted-foreground/40">—</span>}</div>
    </div>
  </div>
);

export const RequestQuickView = memo(function RequestQuickView({ requestId, open, onClose, onEdit }: RequestQuickViewProps) {
  const navigate = useNavigate();
  const [request, setRequest] = useState<Request | null>(null);

  // Fetch request data independently when requestId changes
  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      return;
    }

    let cancelled = false;
    supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) {
          setRequest(data as Request);
        }
      });

    return () => { cancelled = true; };
  }, [requestId]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!request) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 w-[420px] max-w-[90vw] bg-background border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-out",
          "h-auto max-h-screen overflow-y-auto",
          open ? "translate-x-0" : "translate-x-full"
        )}
        style={{ height: "100vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground font-mono">Быстрый просмотр</div>
            <h3 className="text-base font-semibold text-foreground truncate mt-0.5">
              {request.description?.slice(0, 40) || "Заявка"}
            </h3>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-1 pb-24">
          {/* Description */}
          <div className="pb-3 border-b border-border/30">
            <div className="text-xs text-muted-foreground mb-1">Описание</div>
            <p className="text-sm text-foreground leading-relaxed">
              {request.description || <span className="text-muted-foreground/40">—</span>}
            </p>
          </div>

          <InfoRow icon={Building2} label="Контрагент" value={request.contractor} />

          <InfoRow
            icon={CheckCircle}
            label="Статус"
            value={
              <Badge
                className="text-xs px-2 py-0.5"
                style={{ backgroundColor: getStatusColor(request.status), color: "white" }}
              >
                {request.status}
              </Badge>
            }
          />

          <InfoRow
            icon={Flag}
            label="Приоритет"
            value={
              <Badge
                variant="outline"
                className="text-xs px-2 py-0.5"
                style={{
                  borderColor: getPriorityColor(request.priority || "Планово"),
                  color: getPriorityColor(request.priority || "Планово"),
                }}
              >
                {request.priority || "Планово"}
              </Badge>
            }
          />

          <InfoRow icon={User} label="Заявитель" value={request.applicant} />
          <InfoRow icon={User} label="Исполнитель" value={request.executor} />

          <InfoRow
            icon={MessageSquare}
            label="Комментарий"
            value={
              request.comments ? (
                <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{request.comments}</p>
              ) : null
            }
          />

          {/* Documents */}
          {(request.document_urls?.length || request.photo_urls?.length) ? (
            <div className="pt-2">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Документы и файлы
              </div>
              <div className="space-y-1.5">
                {request.document_urls?.map((url, i) => (
                  <a key={`doc-${i}`} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-primary hover:underline py-1">
                    <FileText className="h-3.5 w-3.5" />
                    Документ {i + 1}
                  </a>
                ))}
                {request.photo_urls?.map((url, i) => (
                  <a key={`photo-${i}`} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-primary hover:underline py-1">
                    <FileText className="h-3.5 w-3.5" />
                    Фото {i + 1}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="fixed bottom-0 right-0 w-[420px] max-w-[90vw] px-5 py-3 border-t border-border bg-background flex items-center gap-2 z-10">
          <Button
            className="flex-1 gap-2"
            onClick={() => { onClose(); navigate(`/requests/${request.id}`); }}
          >
            <ExternalLink className="h-4 w-4" />
            Открыть полностью
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => { onClose(); onEdit?.(request); }}
          >
            <Pencil className="h-4 w-4" />
            Редактировать
          </Button>
        </div>
      </div>
    </>
  );
});
