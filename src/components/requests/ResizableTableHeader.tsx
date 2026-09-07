import { useCallback, useRef, useState } from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResizableTableHeaderProps {
  column: string;
  label: string;
  width: number;
  onResize: (column: string, width: number) => void;
  sortable?: boolean;
  isActive?: boolean;
  sortDirection?: "asc" | "desc";
  onSort?: () => void;
  className?: string;
  align?: "left" | "center" | "right";
  defaultWidth?: number;
  children?: React.ReactNode;
}

export const ResizableTableHeader = ({
  column,
  label,
  width,
  onResize,
  sortable = false,
  isActive = false,
  sortDirection,
  onSort,
  className = "",
  align = "center",
  defaultWidth,
  children,
}: ResizableTableHeaderProps) => {
  const headerRef = useRef<HTMLTableCellElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const diff = moveEvent.clientX - startX;
        const newWidth = Math.max(28, startWidth + diff);
        onResize(column, newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [column, width, onResize]
  );

  const Icon = isActive
    ? sortDirection === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead
      ref={headerRef}
      data-align={align}
      data-col={column}
      className={cn(
        "relative p-2 font-medium border-b select-none text-muted-foreground transition-all duration-150 ease-out",
        sortable && "cursor-pointer hover:bg-muted/60",
        className
      )}
      onClick={sortable ? onSort : undefined}
    >
      {children ? (
        <div className="flex items-center justify-start">{children}</div>
      ) : (
        <div
          className={cn(
            "flex w-full items-center gap-1 overflow-hidden",
            align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
          )}
        >
          <span className="truncate text-xs font-medium normal-case tracking-normal">{label}</span>

          {/* Иконка всегда занимает место — заголовок не дёргается при сортировке */}
          <Icon
            className={cn(
              "h-3 w-3 flex-none",
              !sortable ? "invisible" : isActive ? "text-primary" : "text-muted-foreground/50"
            )}
          />
        </div>
      )}

      {/* Resize handle */}
      <div
        title="Потяните, чтобы изменить ширину. Двойной клик — сброс"
        className={cn(
          "absolute top-0 -right-[3px] w-[7px] h-full cursor-col-resize z-20 group/resize flex justify-center",
          isResizing && "bg-primary/20"
        )}
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (defaultWidth) onResize(column, defaultWidth);
        }}
      >
        <span
          className={cn(
            "h-full w-[2px] bg-border transition-colors group-hover/resize:bg-primary",
            isResizing && "bg-primary"
          )}
        />
      </div>

    </TableHead>
  );
};
