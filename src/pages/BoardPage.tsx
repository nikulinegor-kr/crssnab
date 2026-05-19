import { useEffect, useMemo, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useRequests, type Request } from "@/hooks/useRequests";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { BOARD_COLUMNS, getColumnIdForStatus, getColumnById } from "@/lib/boardStatuses";
import { BoardColumn } from "@/components/board/BoardColumn";
import { BoardCard } from "@/components/board/BoardCard";
import { BoardFilters, type BoardFilterKey } from "@/components/board/BoardFilters";

export default function BoardPage() {
  const { data: requests = [], isLoading } = useRequests(false);
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilterKey>("all");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Realtime: при изменении любой заявки в орг — инвалидируем кеш
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

  // Кол-во позиций по каждой заявке (для бейджа на карточке)
  const { data: itemCounts = {} } = useQuery({
    queryKey: ["board-items-count", currentOrgId],
    enabled: !!currentOrgId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_items")
        .select("request_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        if (r.request_id) map[r.request_id] = (map[r.request_id] ?? 0) + 1;
      }
      return map;
    },
  });

  // Применяем фильтры/поиск
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
      if (filter === "no_response" && r.status !== "На согласовании") return false;
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

  const activeRequest = useMemo(
    () => requests.find((r) => r.id === activeId),
    [requests, activeId]
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const overId = String(over.id);
    // overId — это либо id колонки (если дроп в пустую/между картами), либо id карточки.
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

    // Optimistic update
    queryClient.setQueryData<any[]>(["requests", false], (old) =>
      old?.map((r) => (r.id === dragged.id ? { ...r, status: newStatus } : r))
    );

    const { error } = await supabase
      .from("requests")
      .update({ status: newStatus })
      .eq("id", dragged.id);

    if (error) {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({
        title: "Не удалось перенести",
        description: error.message,
        variant: "destructive",
      });
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
          <div
            className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory md:snap-none"
          >
            <div className="flex gap-3 p-3 h-full min-w-max">
              {BOARD_COLUMNS.map((col) => (
                <BoardColumn
                  key={col.id}
                  column={col}
                  requests={byColumn[col.id] ?? []}
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
    </div>
  );
}
