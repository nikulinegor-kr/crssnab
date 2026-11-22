import { useEffect, useRef } from "react";
import type { Request } from "@/hooks/useRequests";
import { getStatusColor } from "@/hooks/useRequestsFilters";
import { formatArrival, groupMobileRequests, isArrivalOverdue, mobileArrivalDate } from "@/lib/mobileRequestList";
import { cn } from "@/lib/utils";

interface Props {
  requests: Request[];
  isLoading?: boolean;
  onOpen: (request: Request) => void;
  grouped?: boolean;
  arrivalLabel?: string;
}

let savedScroll = 0;

export const MobileRequestRow = ({ request, onOpen, arrivalLabel = "Приход" }: { request: Request; onOpen: (r: Request) => void; arrivalLabel?: string }) => {
  const overdue = isArrivalOverdue(request);
  return (
    <li className="border-b border-border last:border-b-0">
      <button type="button" onClick={() => onOpen(request)} className="block w-full min-w-0 px-0 py-3 text-left [overflow-wrap:anywhere]">
        <span className="block break-words text-[15px] font-medium leading-snug text-foreground">{request.description || "—"}</span>
        <span className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
          <span className="flex min-w-0 items-center gap-1.5">
            <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getStatusColor(request.status) }} aria-hidden="true" />
            <span className="break-words" style={{ color: getStatusColor(request.status) }}>{request.status || "—"}</span>
          </span>
          <span className={cn("ml-auto shrink-0 font-numeric whitespace-nowrap", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
            {arrivalLabel} {formatArrival(mobileArrivalDate(request))}
          </span>
        </span>
        <span className="mt-1 block break-words text-[13px] text-muted-foreground">ТК {request.transport_company?.trim() || "—"}</span>
      </button>
    </li>
  );
};

export const MobileRequestList = ({ requests, isLoading, onOpen, grouped = true, arrivalLabel }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = savedScroll;
    return () => { if (el) savedScroll = el.scrollTop; };
  }, []);

  if (isLoading) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Загрузка…</p>;
  if (requests.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Заявки не найдены</p>;

  const groups = grouped ? groupMobileRequests(requests) : [{ stage: 0, label: "", items: requests }];
  return (
    <div ref={ref} onScroll={(e) => { savedScroll = e.currentTarget.scrollTop; }} className="mobile-request-list min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-card px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] max-[340px]:px-3">
      {groups.map((g) => (
        <section key={g.stage} aria-label={g.label || undefined}>
          {g.label && (
            <h2 className="sticky top-0 z-[1] -mx-4 bg-muted px-4 py-1.5 text-xs font-semibold text-muted-foreground max-[340px]:-mx-3 max-[340px]:px-3">
              {g.label} · <span className="font-numeric">{g.items.length}</span>
            </h2>
          )}
          <ul>{g.items.map((r) => <MobileRequestRow key={r.id} request={r} onOpen={onOpen} arrivalLabel={arrivalLabel} />)}</ul>
        </section>
      ))}
    </div>
  );
};
