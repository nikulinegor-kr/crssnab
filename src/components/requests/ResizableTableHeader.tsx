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
  align?: "left" | "center";
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
      className={cn(
        "relative p-2 font-bold border-r border-b text-center select-none text-foreground/80 tracking-wide transition-all duration-150 ease-out",
        sortable && "cursor-pointer hover:bg-muted/60",
        className
      )}
      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, transition: isResizing ? 'none' : 'width 150ms ease-out, min-width 150ms ease-out, max-width 150ms ease-out' }}
      onClick={sortable ? onSort : undefined}
    >
      {children ? (
        <div className="flex items-center justify-center">{children}</div>
      ) : (
        <div className={cn("flex items-center gap-0.5 overflow-hidden", align === "left" ? "justify-start" : "justify-center")}>
          <span className="truncate text-xs uppercase">{label}</span>
          {sortable && (
            <Icon
              className={cn(
                "h-3 w-3 flex-shrink-0",
                isActive ? "text-primary" : "text-muted-foreground/50"
              )}
            />
          )}
        </div>
      )}
      {/* Resize handle */}
      <div
        className={cn(
          "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-20",
          isResizing && "bg-primary"
        )}
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
      />
    </TableHead>
  );
};
