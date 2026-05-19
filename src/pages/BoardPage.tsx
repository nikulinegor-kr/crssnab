import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  closestCorners,
} from "@dnd-kit/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequests, type Request } from "@/hooks/useRequests";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { BOARD_COLUMNS, getColumnIdForStatus, getColumnById } from "@/lib/boardStatuses";
import { BoardColumn } from "@/components/board/BoardColumn";
import { BoardCard } from "@/components/board/BoardCard";
import { BoardFilters, type BoardFilterKey } from "@/components/board/BoardFilters";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequestActivityFeed } from "@/components/request/RequestActivityFeed";

export default function BoardPage() {
  const { data: requests = [], isLoading } = useRequests(false);
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilterKey>("all");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Realtime
  useEffect(() => {
    if (!currentOrgId) return;
    const ch = supabase
      .channel("board-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests", filter: `organization_id=eq.${currentOrgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["requests"] });
          queryClient.invalidateQueries({ queryKey: ["board-items-count"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentOrgId, queryClient]);

  // Кол-во позиций по каждой заявке
  const { data: itemCounts = {} } = useQuery({
    queryKey: ["board-items-count", currentOrgId],
    enabled: !!currentOrgId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("request_items").select("request_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        if (r.request_id) map[r.request_id] = (map[r.request_id] ?? 0) + 1;
      }
      return map;
    },
  });

  const filtered = useMemo(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];

    return requests.filter((r) => {
      if (filter === "mine") {
        if (!userId) return false;
        if ((r as any).created_by !== userId && r.applicant_user_id !== userId) return false;
      }
      if (filter === "urgent" && !(r.priority === "Аварийно" || r.priority === "Срочно")) return false;
      if (filter === "overdue") {
        if (!r.delivery_date) return false;
        if (new Date(r.delivery_date) >= now) return false;
        if (["Доставлено", "Выполнено"].includes(r.status)) return false;
      }
      if (filter === "no_response" && r.status !== "На согласовании" && r.status !== "Ожидание ответа" && r.status !== "Ожидание КП") return false;
      if (filter === "no_supplier" && r.contractor) return false;

      if (terms.length) {
        const hay = [
          r.description,
          r.contractor,
          r.executor,
          r.request_number,
          (r as any).object_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
  }, [requests, filter, search, userId]);

  const byColumn = useMemo(() => {
    const map: Record<string, (Request & { items_count?: number })[]> = {};
    BOARD_COLUMNS.forEach((c) => (map[c.id] = []));
    for (const r of filtered) {
      const colId = getColumnIdForStatus(r.status);
      if (!map[colId]) map[colId] = [];
      map[colId].push({ ...r, items_count: itemCounts[r.id] });
    }
    return map;
  }, [filtered, itemCounts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  );

  const activeRequest = useMemo(() => requests.find((r) => r.id === activeId), [requests, activeId]);
  const openRequest = useMemo(() => requests.find((r) => r.id === openId), [requests, openId]);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const overId = String(over.id);
    let targetColId = getColumnById(overId)?.id;
    if (!targetColId) {
      const overReq = requests.find((r) => r.id === overId);
      if (overReq) targetColId = getColumnIdForStatus(overReq.status);
    }
    if (!targetColId) return;

    const dragged = requests.find((r) => r.id === String(active.id));
    if (!dragged) return;

    const currentColId = getColumnIdForStatus(dragged.status);
    if (currentColId === targetColId) return;

    const targetCol = getColumnById(targetColId)!;
    const newStatus = targetCol.targetStatus;

    queryClient.setQueryData<any[]>(["requests", false], (old) =>
      old?.map((r) => (r.id === dragged.id ? { ...r, status: newStatus } : r))
    );

    const { error } = await supabase.from("requests").update({ status: newStatus }).eq("id", dragged.id);

    if (error) {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Не удалось перенести", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: `→ ${targetCol.title}`,
        description: dragged.description || `Заявка ${dragged.request_number}`,
      });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] bg-background">
      <BoardFilters
        active={filter}
        onChange={setFilter}
        search={search}
        onSearchChange={setSearch}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Загрузка доски…
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory md:snap-none">
            <div className="flex gap-3 p-3 h-full min-w-max">
              {BOARD_COLUMNS.map((col) => (
                <BoardColumn
                  key={col.id}
                  column={col}
                  requests={byColumn[col.id] ?? []}
                  onOpen={setOpenId}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeRequest && (
              <div className="w-[284px]">
                <BoardCard
                  request={{ ...activeRequest, items_count: itemCounts[activeRequest.id] }}
                  overlay
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          {openRequest && (
            <>
              <SheetHeader className="px-5 py-4 border-b">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">#{openRequest.request_number}</Badge>
                  <Badge className="text-[10px]">{openRequest.status}</Badge>
                  {openRequest.priority && (
                    <Badge variant="secondary" className="text-[10px]">{openRequest.priority}</Badge>
                  )}
                </div>
                <SheetTitle className="text-left text-base leading-snug">
                  {openRequest.description || `Заявка ${openRequest.request_number}`}
                </SheetTitle>
                {openRequest.contractor && (
                  <SheetDescription className="text-left">{openRequest.contractor}</SheetDescription>
                )}
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Исполнитель" value={openRequest.executor} />
                  <Field label="Заявитель" value={openRequest.applicant} />
                  <Field
                    label="Доставка"
                    value={
                      openRequest.delivery_date
                        ? format(new Date(openRequest.delivery_date), "d MMM yyyy", { locale: ru })
                        : null
                    }
                  />
                  <Field
                    label="Сумма"
                    value={
                      openRequest.amount
                        ? new Intl.NumberFormat("ru-RU").format(openRequest.amount) + " ₽"
                        : null
                    }
                  />
                  <Field label="Оплата" value={openRequest.payment_status} />
                  <Field
                    label="Обновлено"
                    value={
                      openRequest.updated_at
                        ? format(new Date(openRequest.updated_at), "d MMM HH:mm", { locale: ru })
                        : null
                    }
                  />
                </div>

                {openRequest.comments && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Комментарий
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{openRequest.comments}</div>
                  </div>
                )}

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    История
                  </div>
                  <RequestActivityFeed requestId={openRequest.id} />
                </div>
              </div>

              <div className="border-t p-3">
                <Button asChild className="w-full">
                  <Link to={`/requests/${openRequest.id}`}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Открыть полную заявку
                  </Link>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value || "—"}</div>
    </div>
  );
}
