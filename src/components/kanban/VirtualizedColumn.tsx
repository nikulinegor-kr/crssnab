import React, { memo, ReactElement, CSSProperties, useRef, useState, useEffect } from "react";
import { List } from "react-window";
import { KanbanCard } from "./KanbanCard";
import { useNavigate } from "react-router-dom";

interface Request {
  id: string;
  request_number: string;
  description: string;
  status: string;
  priority: string;
  applicant: string | null;
  contractor: string | null;
  request_date: string;
  delivery_date: string | null;
  executor: string | null;
}

interface VirtualizedColumnProps {
  requests: Request[];
  isSelectionMode: boolean;
  selectedRequests: Set<string>;
  draggingRequest: string | null;
  settings: {
    showRequestNumber: boolean;
    showPriority: boolean;
    showDeadline: boolean;
    showExecutor: boolean;
    showApplicant: boolean;
    showContractor: boolean;
  };
  onDragStart: (e: React.DragEvent, requestId: string) => void;
  onDragEnd: () => void;
  toggleRequestSelection: (requestId: string, e: React.MouseEvent) => void;
  getDeadlineStatus: (deliveryDate: string | null, status: string) => { isOverdue: boolean; daysOverdue: number; label: string } | null;
  getPriorityColor: (priority: string) => string;
}

const CARD_HEIGHT = 140;
const CARD_GAP = 10;

interface RowProps {
  requests: Request[];
  isSelectionMode: boolean;
  selectedRequests: Set<string>;
  draggingRequest: string | null;
  settings: VirtualizedColumnProps['settings'];
  onDragStart: (e: React.DragEvent, requestId: string) => void;
  onDragEnd: () => void;
  toggleRequestSelection: (requestId: string, e: React.MouseEvent) => void;
  getDeadlineStatus: VirtualizedColumnProps['getDeadlineStatus'];
  getPriorityColor: (priority: string) => string;
  navigate: (path: string) => void;
}

function RowComponent({
  index,
  style,
  requests,
  isSelectionMode,
  selectedRequests,
  draggingRequest,
  settings,
  onDragStart,
  onDragEnd,
  toggleRequestSelection,
  getDeadlineStatus,
  getPriorityColor,
  navigate,
}: {
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
  index: number;
  style: CSSProperties;
} & RowProps): ReactElement {
  const request = requests[index];
  if (!request) return <div style={style} />;

  const deadlineStatus = getDeadlineStatus(request.delivery_date, request.status);
  const isSelected = selectedRequests.has(request.id);
  const isDragging = draggingRequest === request.id;

  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      toggleRequestSelection(request.id, e);
    } else {
      navigate(`/requests/${request.id}`);
    }
  };

  return (
    <KanbanCard
      key={request.id}
      request={request}
      isSelectionMode={isSelectionMode}
      isSelected={isSelected}
      isDragging={isDragging}
      deadlineStatus={deadlineStatus}
      settings={settings}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      getPriorityColor={getPriorityColor}
      style={{
        ...style,
        height: (style.height as number) - CARD_GAP,
        paddingTop: index === 0 ? 10 : 0,
      }}
    />
  );
}

export const VirtualizedColumn = memo(function VirtualizedColumn({
  requests,
  isSelectionMode,
  selectedRequests,
  draggingRequest,
  settings,
  onDragStart,
  onDragEnd,
  toggleRequestSelection,
  getDeadlineStatus,
  getPriorityColor,
}: VirtualizedColumnProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  // Use ResizeObserver to track container height
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (height > 0) {
          setContainerHeight(height);
        }
      }
    });

    resizeObserver.observe(container);
    
    // Set initial height
    const initialHeight = container.getBoundingClientRect().height;
    if (initialHeight > 0) {
      setContainerHeight(initialHeight);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  if (requests.length === 0) {
    return (
      <div ref={containerRef} className="flex-1 min-h-0">
        <div className="text-center py-8 text-sm text-muted-foreground">
          Нет заявок
        </div>
      </div>
    );
  }

  // For small lists, use regular rendering to avoid virtualization overhead
  if (requests.length <= 10) {
    return (
      <div ref={containerRef} className="p-2.5 space-y-2.5 flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {requests.map((request) => {
          const deadlineStatus = getDeadlineStatus(request.delivery_date, request.status);
          const isSelected = selectedRequests.has(request.id);
          const isDragging = draggingRequest === request.id;

          const handleClick = (e: React.MouseEvent) => {
            if (isSelectionMode) {
              toggleRequestSelection(request.id, e);
            } else {
              navigate(`/requests/${request.id}`);
            }
          };

          return (
            <KanbanCard
              key={request.id}
              request={request}
              isSelectionMode={isSelectionMode}
              isSelected={isSelected}
              isDragging={isDragging}
              deadlineStatus={deadlineStatus}
              settings={settings}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={handleClick}
              getPriorityColor={getPriorityColor}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 min-h-0">
      <List
        style={{ height: containerHeight }}
        rowCount={requests.length}
        rowHeight={CARD_HEIGHT + CARD_GAP}
        rowComponent={RowComponent}
        rowProps={{
          requests,
          isSelectionMode,
          selectedRequests,
          draggingRequest,
          settings,
          onDragStart,
          onDragEnd,
          toggleRequestSelection,
          getDeadlineStatus,
          getPriorityColor,
          navigate,
        }}
        className="scrollbar-thin"
      />
    </div>
  );
});
