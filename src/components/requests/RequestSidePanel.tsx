import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X, Maximize2, FileText, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Request } from "@/hooks/useRequests";
import { getStatusColor, getPriorityColor, STATUSES, PRIORITIES } from "@/hooks/useRequestsFilters";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RequestSidePanelProps {
  request: (Request & { object_name?: string | null }) | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (request: Request) => void;
  onOpenFull?: (request: Request) => void;
}

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const dt = (v?: string | null) => (v ? format(new Date(v), "dd.MM.yy") : "—");

const Row = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) => (
  <div className="flex items-start gap-3 py-[3px]">
    <div className="w-[86px] shrink-0 text-[10px] leading-4 text-muted-foreground">{label}</div>
    <div
      className={cn(
        "min-w-0 flex-1 text-[11px] leading-4 break-words",
        accent ? "text-[hsl(24_90%_48%)]" : "text-foreground"
      )}
    >
      {value || <span className="text-muted-foreground">—</span>}
    </div>
  </div>
);

export const RequestSidePanel = ({ request, open, onClose, onEdit, onOpenFull }: RequestSidePanelProps) => {
  const [tab, setTab] = useState<"overview" | "items" | "docs" | "history">("overview");

  const { data: items } = useQuery({
    queryKey: ["request-items", request?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_items")
        .select("*")
        .eq("request_id", request!.id)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!request?.id && open,
  });

  const { data: history } = useQuery({
    queryKey: ["request-audit", request?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, created_at")
        .eq("entity_id", request!.id)
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

  return createPortal(
    <div className="requests-registry fixed inset-y-0 right-0 z-50 flex w-[380px] max-w-[92vw] flex-col border-l border-border bg-card shadow-[-8px_0_24px_-16px_rgba(15,23,42,0.35)] animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-start gap-2 px-4 pt-3">
        <h2 className="min-w-0 flex-1 text-[13px] font-semibold leading-tight">{request.description}</h2>
        <button
          onClick={() => onOpenFull?.(request)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Открыть полностью"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Закрыть">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 pt-1.5 text-[10px] text-muted-foreground font-numeric">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getStatusColor(request.status) }} />
          <span className="text-foreground/80">{request.status}</span>
        </span>
        <span>{request.request_number}</span>
        <span>{dt(request.request_date)}</span>
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
      <div className="flex-1 overflow-y-auto px-4 py-3">
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
                <span className={paid >= 100 ? "text-emerald-600" : "text-[hsl(24_90%_45%)]"}>
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
      <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
        <button
          onClick={() => onEdit?.(request)}
          className="h-7 bg-primary px-3 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          Редактировать
        </button>
        <button
          onClick={() => onOpenFull?.(request)}
          className="h-7 border border-input bg-card px-3 text-[11px] font-medium hover:bg-muted"
        >
          Открыть заявку
        </button>
      </div>
    </div>,
    document.body
  );
};
