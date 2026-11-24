import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Request } from "@/hooks/useRequests";
import { getStatusColor } from "@/hooks/useRequestsFilters";
import { formatArrival, isArrivalOverdue, mobileArrivalDate } from "@/lib/mobileRequestList";
import { ChevronDown } from "lucide-react";
import { DEFAULT_COLLAPSED_REQUEST_PHASES, groupRequestsByPhase } from "@/lib/requestPhases";
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
  const listId = useId();
  const [activePhase, setActivePhase] = useState<string | null>();
  const [limits, setLimits] = useState<Record<string, number>>({});
  const groups = useMemo(() => groupRequestsByPhase(requests), [requests]);
  const expandedPhase = activePhase === null || groups.some(phase => phase.key === activePhase) ? activePhase : groups.find(phase => !DEFAULT_COLLAPSED_REQUEST_PHASES.has(phase.key))?.key;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = savedScroll;
    return () => { if (el) savedScroll = el.scrollTop; };
  }, []);

  if (isLoading) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Загрузка…</p>;
  if (requests.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Заявки не найдены</p>;

  return (
    <div ref={ref} onScroll={(e) => { savedScroll = e.currentTarget.scrollTop; }} className="mobile-request-list min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-card pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {!grouped ? (
        <ul className="px-4">{requests.map(request => <MobileRequestRow key={request.id} request={request} onOpen={onOpen} arrivalLabel={arrivalLabel} />)}</ul>
      ) : groups.map(phase => {
        const expanded = expandedPhase === phase.key;
        const limit = limits[phase.key] ?? 8;
        const contentId = `${listId}-${phase.key}`;
        return (
          <section key={phase.key} className="border-b border-border last:border-b-0">
            <h2 className="sticky top-0 z-[1] bg-card">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={contentId}
                onClick={() => setActivePhase(expanded ? null : phase.key)}
                className={cn("flex min-h-12 w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-semibold", expanded && "bg-muted")}
              >
                <span className={cn("size-2 shrink-0 rounded-full", phase.accent)} aria-hidden="true" />
                <span className="min-w-0 flex-1 break-words">{phase.name}</span>
                <span className="rounded-md bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{phase.items.length}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground", expanded && "rotate-180")} aria-hidden="true" />
              </button>
            </h2>
            <div id={contentId} hidden={!expanded} className="px-4">
              {expanded && <>
                <ul>{phase.items.slice(0, limit).map(request => <MobileRequestRow key={request.id} request={request} onOpen={onOpen} arrivalLabel={arrivalLabel} />)}</ul>
                {phase.items.length > limit && <button type="button" className="min-h-11 w-full border-t text-sm font-medium text-primary" onClick={() => setLimits(current => ({ ...current, [phase.key]: limit + 20 }))}>Показать ещё ({phase.items.length - limit})</button>}
              </>}
            </div>
          </section>
        );
      })}
    </div>
  );
};
