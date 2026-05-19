import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { BoardCard } from "./BoardCard";
import type { BoardColumn as ColumnDef } from "@/lib/boardStatuses";
import type { Request } from "@/hooks/useRequests";

interface Props {
  column: ColumnDef;
  requests: (Request & { items_count?: number })[];
  onOpen?: (id: string) => void;
}

export function BoardColumn({ column, requests, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col w-[300px] shrink-0 snap-start h-full md:w-[300px]">
      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("h-2 w-2 rounded-full", column.accent)} />
          <h3 className="text-sm font-semibold truncate">{column.title}</h3>
          <span className="text-xs text-muted-foreground font-numeric">{requests.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[200px] rounded-xl bg-muted/40 p-2 space-y-2 overflow-y-auto transition-colors",
          isOver && "bg-primary/5 ring-2 ring-primary/30"
        )}
      >
        <SortableContext
          items={requests.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          {requests.map((r) => (
            <BoardCard key={r.id} request={r} />
          ))}
        </SortableContext>
        {requests.length === 0 && (
          <div className="text-xs text-muted-foreground/60 text-center py-6">пусто</div>
        )}
      </div>
    </div>
  );
}
