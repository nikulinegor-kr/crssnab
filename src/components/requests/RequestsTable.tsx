import { useState, useEffect, useCallback, memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Trash2, ChevronLeft, ChevronRight, Check, X, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequestQuickPreview } from "@/components/RequestQuickPreview";
import { Request } from "@/hooks/useRequests";
import { getStatusColor, getPriorityColor } from "@/hooks/useRequestsFilters";
import { HighlightText } from "@/components/HighlightText";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const STORAGE_KEY = "requests-page-size";
const SORT_STORAGE_KEY = "requests-sort";

type SortField = 
  | "request_date" 
  | "description" 
  | "priority" 
  | "status" 
  | "contractor" 
  | "payment_percentage" 
  | "applicant" 
  | "executor"
  | "shipment_date"
  | "delivery_date"
  | "invoice_number"
  | "transport_company"
  | "waybill_number";

type SortDirection = "asc" | "desc";

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// Sortable header component
const SortableHeader = ({
  field,
  label,
  currentSort,
  onSort,
  className = "",
}: {
  field: SortField;
  label: string;
  currentSort: SortConfig | null;
  onSort: (field: SortField) => void;
  className?: string;
}) => {
  const isActive = currentSort?.field === field;
  const Icon = isActive 
    ? (currentSort.direction === "asc" ? ArrowUp : ArrowDown)
    : ArrowUpDown;
  
  return (
    <TableHead 
      className={`cursor-pointer hover:bg-muted/60 transition-colors select-none ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-0.5 justify-center">
        <span>{label}</span>
        <Icon className={`h-3 w-3 ${isActive ? "text-primary" : "text-muted-foreground/50"}`} />
      </div>
    </TableHead>
  );
};

interface RequestsTableProps {
  requests: Request[] | undefined;
  isLoading: boolean;
  selectedRequestIds: Set<string>;
  toggleRequestSelection: (id: string) => void;
  toggleAllRequests: () => void;
  onDeleteClick: (request: Request, e: React.MouseEvent) => void;
  onEditClick?: (request: Request) => void;
  searchQuery?: string;
}

// Memoized mobile card component for better performance
const MobileRequestCard = memo(({
  request,
  isSelected,
  onToggleSelection,
  onRowClick,
  onDelete,
  searchQuery,
}: {
  request: Request;
  isSelected: boolean;
  onToggleSelection: () => void;
  onRowClick: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  searchQuery: string;
}) => (
  <Card
    className="p-2 cursor-pointer hover:bg-muted/30 transition-colors active:bg-muted/50"
    onClick={onRowClick}
  >
    <div className="flex items-start gap-2">
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggleSelection}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 h-4 w-4 flex-shrink-0"
      />
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header row with date, priority, status */}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-medium">
            {format(new Date(request.request_date), "dd.MM.yy")}
          </span>
          <div className="flex items-center gap-1">
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-4 leading-none"
              style={{
                borderColor: getPriorityColor(request.priority || "Планово"),
                color: getPriorityColor(request.priority || "Планово"),
              }}
            >
              {request.priority || "Планово"}
            </Badge>
            <Badge
              className="text-[9px] px-1 py-0 h-4 leading-none"
              style={{
                backgroundColor: getStatusColor(request.status),
                color: "white",
              }}
            >
              {request.status}
            </Badge>
          </div>
        </div>

        {/* Description */}
        <div className="font-medium text-xs leading-tight line-clamp-2">
          <HighlightText text={request.description} searchQuery={searchQuery} />
        </div>

        {/* Compact info row */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          {request.contractor && (
            <span className="truncate max-w-[100px]">
              <span className="font-medium">К:</span> <HighlightText text={request.contractor} searchQuery={searchQuery} />
            </span>
          )}
          {request.applicant && (
            <span className="truncate max-w-[80px]">
              <span className="font-medium">З:</span> <HighlightText text={request.applicant} searchQuery={searchQuery} />
            </span>
          )}
          {request.payment_percentage !== null && request.payment_percentage !== undefined && (
            <span className="font-semibold text-primary">{request.payment_percentage}%</span>
          )}
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  </Card>
));

MobileRequestCard.displayName = "MobileRequestCard";

export const RequestsTable = ({
  requests,
  isLoading,
  selectedRequestIds,
  toggleRequestSelection,
  toggleAllRequests,
  onDeleteClick,
  onEditClick,
  searchQuery = "",
}: RequestsTableProps) => {
  const navigate = useNavigate();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 25;
  });

  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return { field: "request_date", direction: "desc" };
  });

  const handleSort = useCallback((field: SortField) => {
    setSortConfig((prev) => {
      let newConfig: SortConfig;
      if (prev?.field === field) {
        newConfig = { field, direction: prev.direction === "asc" ? "desc" : "asc" };
      } else {
        newConfig = { field, direction: "desc" };
      }
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(newConfig));
      return newConfig;
    });
    setCurrentPage(1);
  }, []);

  // Sort requests
  const sortedRequests = useMemo(() => {
    if (!requests || !sortConfig) return requests;

    return [...requests].sort((a, b) => {
      const { field, direction } = sortConfig;
      let aVal = a[field];
      let bVal = b[field];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return direction === "asc" ? 1 : -1;
      if (bVal == null) return direction === "asc" ? -1 : 1;

      // Compare based on type
      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const comparison = aStr.localeCompare(bStr, "ru");
      return direction === "asc" ? comparison : -comparison;
    });
  }, [requests, sortConfig]);

  // Reset to page 1 when requests change
  useEffect(() => {
    setCurrentPage(1);
  }, [requests?.length]);

  const handlePageSizeChange = useCallback((value: string) => {
    const newSize = parseInt(value, 10);
    setPageSize(newSize);
    localStorage.setItem(STORAGE_KEY, value);
    setCurrentPage(1);
  }, []);

  const handleRowClick = useCallback((request: Request, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    navigate(`/requests/${request.id}`);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 sm:h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-base font-medium">Заявки не найдены</p>
        <p className="text-sm text-muted-foreground">
          Попробуйте изменить фильтры
        </p>
      </div>
    );
  }

  // Pagination calculations
  const totalItems = sortedRequests?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRequests = sortedRequests?.slice(startIndex, endIndex) || [];

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Compact Pagination UI
  const PaginationControls = () => (
    <div className="flex items-center justify-between gap-2 py-2 border-t mt-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
          <SelectTrigger className="w-14 h-6 text-[11px] px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={size.toString()} className="text-xs">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden xs:inline">/ {totalItems}</span>
      </div>
      
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted-foreground mr-1">
          {startIndex + 1}-{Math.min(endIndex, totalItems)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => goToPage(1)}
          disabled={currentPage === 1}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[11px] font-medium px-1 min-w-[2.5rem] text-center">
          {currentPage}/{totalPages || 1}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => goToPage(totalPages)}
          disabled={currentPage === totalPages || totalPages === 0}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile View - Compact Cards */}
      <div className="lg:hidden space-y-1.5">
        {paginatedRequests.map((request) => (
          <MobileRequestCard
            key={request.id}
            request={request}
            isSelected={selectedRequestIds.has(request.id)}
            onToggleSelection={() => toggleRequestSelection(request.id)}
            onRowClick={(e) => handleRowClick(request, e)}
            onDelete={(e) => onDeleteClick(request, e)}
            searchQuery={searchQuery}
          />
        ))}
        <PaginationControls />
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block rounded-md border overflow-x-auto">
        <Table className="w-full table-fixed text-sm">
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            <TableRow className="border-b hover:bg-transparent">
              <TableHead className="w-10 text-center p-2 border-r">
                <Checkbox
                  checked={selectedRequestIds.size === requests.length && requests.length > 0}
                  onCheckedChange={toggleAllRequests}
                  className="h-4 w-4"
                />
              </TableHead>
              <SortableHeader field="request_date" label="Дата" currentSort={sortConfig} onSort={handleSort} className="w-20 p-2 font-semibold border-r text-center" />
              <SortableHeader field="description" label="Заявка" currentSort={sortConfig} onSort={handleSort} className="min-w-[200px] p-2 font-semibold border-r text-left" />
              <SortableHeader field="priority" label="Приоритет" currentSort={sortConfig} onSort={handleSort} className="w-32 p-2 font-semibold border-r text-center" />
              <SortableHeader field="status" label="Статус" currentSort={sortConfig} onSort={handleSort} className="w-36 p-2 font-semibold border-r text-center" />
              <SortableHeader field="contractor" label="Контрагент" currentSort={sortConfig} onSort={handleSort} className="w-32 p-2 font-semibold border-r text-center" />
              <SortableHeader field="invoice_number" label="Счёт" currentSort={sortConfig} onSort={handleSort} className="w-28 p-2 font-semibold border-r hidden xl:table-cell text-center" />
              <SortableHeader field="payment_percentage" label="Оплата" currentSort={sortConfig} onSort={handleSort} className="w-20 p-2 font-semibold border-r text-center" />
              <SortableHeader field="applicant" label="Заявитель" currentSort={sortConfig} onSort={handleSort} className="w-28 p-2 font-semibold border-r text-center" />
              <TableHead className="w-36 p-2 font-semibold border-r hidden xl:table-cell text-center">Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRequests.map((request) => (
              <TableRow
                key={request.id}
                className="hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={(e) => handleRowClick(request, e)}
              >
                <TableCell className="text-center p-2 border-r" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedRequestIds.has(request.id)}
                    onCheckedChange={() => toggleRequestSelection(request.id)}
                    className="h-4 w-4"
                  />
                </TableCell>
                <TableCell className="text-center p-2 border-r text-muted-foreground">
                  {format(new Date(request.request_date), "dd.MM.yy")}
                </TableCell>
                <TableCell className="text-left p-2 border-r">
                  <RequestQuickPreview
                    request={request}
                    getStatusColor={getStatusColor}
                    getPriorityColor={getPriorityColor}
                    onEdit={onEditClick}
                  >
                    <div className="line-clamp-2 hover:text-primary transition-colors font-medium leading-tight">
                      <HighlightText text={request.description} searchQuery={searchQuery} />
                    </div>
                  </RequestQuickPreview>
                </TableCell>
                <TableCell className="text-center p-2 border-r">
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
                </TableCell>
                <TableCell className="text-center p-2 border-r">
                  <Badge
                    className="text-xs px-2 py-0.5"
                    style={{
                      backgroundColor: getStatusColor(request.status),
                      color: "white",
                    }}
                  >
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center p-2 border-r">
                  <div className="line-clamp-2 leading-tight">
                    <HighlightText text={request.contractor || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-center p-2 border-r hidden xl:table-cell">
                  <div className="line-clamp-2 text-muted-foreground leading-tight">
                    <HighlightText text={request.invoice_number || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-center p-2 border-r font-semibold">
                  {request.payment_percentage !== null && request.payment_percentage !== undefined
                    ? <span className={request.payment_percentage === 100 ? "text-green-600" : "text-primary"}>{request.payment_percentage}%</span>
                    : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-center p-2 border-r">
                  <div className="line-clamp-2 leading-tight">
                    <HighlightText text={request.applicant || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-center p-2 border-r hidden xl:table-cell">
                  <div className="line-clamp-2 text-muted-foreground italic leading-tight">
                    <HighlightText text={request.comments || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls />
      </div>
    </>
  );
};
