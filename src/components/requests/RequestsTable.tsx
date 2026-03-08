import { useState, useEffect, useCallback, memo, useMemo, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Star, Eye, MoreVertical, ExternalLink, Pencil, Copy, ShoppingCart } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RequestQuickPreview } from "@/components/RequestQuickPreview";
import { Request } from "@/hooks/useRequests";
import { getStatusColor, getPriorityColor } from "@/hooks/useRequestsFilters";
import { HighlightText } from "@/components/HighlightText";
import { TableColumnSettings } from "./TableColumnSettings";
import { useTableColumnVisibility } from "@/hooks/useTableColumnVisibility";
import { useTableColumnWidths, ColumnWidths } from "@/hooks/useTableColumnWidths";
import { ResizableTableHeader } from "./ResizableTableHeader";
import { InlineEditCell } from "./InlineEditCell";
import { RequestQuickView } from "./RequestQuickView";

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
  | "waybill_number"
  | "amount";

type SortDirection = "asc" | "desc";

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface RequestsTableProps {
  requests: Request[] | undefined;
  isLoading: boolean;
  selectedRequestIds: Set<string>;
  toggleRequestSelection: (id: string) => void;
  toggleAllRequests: () => void;
  onDeleteClick: (request: Request, e: React.MouseEvent) => void;
  onEditClick?: (request: Request) => void;
  onDuplicateClick?: (request: Request) => void;
  onCreateProcurement?: (request: Request) => void;
  searchQuery?: string;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (requestId: string) => void;
  headerActions?: ReactNode;
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
  onDuplicateClick,
  onCreateProcurement,
  searchQuery = "",
  favoriteIds,
  onToggleFavorite,
  headerActions,
}: RequestsTableProps) => {
  const navigate = useNavigate();
  const { visibility, updateVisibility } = useTableColumnVisibility();
  const { widths, updateWidth } = useTableColumnWidths();
  
  // Quick View state — only store ID to avoid re-renders from table data updates
  const [quickViewRequestId, setQuickViewRequestId] = useState<string | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  const openQuickView = useCallback((request: Request) => {
    setQuickViewRequestId(request.id);
    setQuickViewOpen(true);
  }, []);

  const closeQuickView = useCallback(() => {
    setQuickViewOpen(false);
  }, []);

  const handleColumnResize = useCallback((column: string, width: number) => {
    updateWidth(column as keyof ColumnWidths, width);
  }, [updateWidth]);
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

  const clickTimerRef = useCallback(() => {}, []);
  const [clickTimer, setClickTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleRowClick = useCallback((request: Request, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    // Delay navigation to distinguish from double-click
    const timer = setTimeout(() => {
      navigate(`/requests/${request.id}`);
    }, 250);
    setClickTimer(timer);
  }, [navigate]);

  const handleRowDoubleClick = useCallback((request: Request, e: React.MouseEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
    // Cancel pending single-click navigation
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
    }
    openQuickView(request);
  }, [openQuickView, clickTimer]);

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
    <div className="flex gap-4 items-start">
      <div className="flex-1 min-w-0">
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
      <div className="hidden lg:block">
        <div className="flex items-center justify-end gap-2 mb-2">
          {headerActions}
          <TableColumnSettings visibility={visibility} onVisibilityChange={updateVisibility} />
        </div>
        <div className="rounded-md border overflow-x-auto">
        <Table className="text-sm" style={{ tableLayout: 'fixed' }}>
          <TableHeader className="sticky top-0 z-10 bg-muted backdrop-blur-sm shadow-[0_2px_4px_rgba(0,0,0,0.08)]">
            <TableRow className="border-b hover:bg-transparent" style={{ height: '44px' }}>
              <TableHead className="w-1 p-0"></TableHead>
              <TableHead className="w-8 text-center p-1 border-r text-[10px] text-muted-foreground">№</TableHead>
              <TableHead className="w-10 text-center p-2 border-r">
                <Checkbox
                  checked={selectedRequestIds.size === requests.length && requests.length > 0}
                  onCheckedChange={toggleAllRequests}
                  className="h-4 w-4"
                />
              </TableHead>
              {onToggleFavorite && (
                <TableHead className="w-8 text-center p-1 border-r">
                  <Star className="h-3.5 w-3.5 mx-auto text-muted-foreground/50" />
                </TableHead>
              )}
              <TableHead className="w-8 text-center p-1 border-r">
                <Eye className="h-3.5 w-3.5 mx-auto text-muted-foreground/50" />
              </TableHead>
              {visibility.request_date && (
                <ResizableTableHeader column="request_date" label="Дата" width={widths.request_date} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "request_date"} sortDirection={sortConfig?.direction} onSort={() => handleSort("request_date")} />
              )}
              {visibility.description && (
                <ResizableTableHeader column="description" label="Заявка" width={widths.description} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "description"} sortDirection={sortConfig?.direction} onSort={() => handleSort("description")} className="text-left" />
              )}
              {visibility.priority && (
                <ResizableTableHeader column="priority" label="Приоритет" width={widths.priority} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "priority"} sortDirection={sortConfig?.direction} onSort={() => handleSort("priority")} />
              )}
              {visibility.status && (
                <ResizableTableHeader column="status" label="Статус" width={widths.status} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "status"} sortDirection={sortConfig?.direction} onSort={() => handleSort("status")} />
              )}
              {visibility.availability && (
                <ResizableTableHeader column="availability" label="Наличие" width={widths.availability} onResize={handleColumnResize} />
              )}
              {visibility.contractor && (
                <ResizableTableHeader column="contractor" label="Контрагент" width={widths.contractor} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "contractor"} sortDirection={sortConfig?.direction} onSort={() => handleSort("contractor")} />
              )}
              {visibility.invoice_number && (
                <ResizableTableHeader column="invoice_number" label="Счёт" width={widths.invoice_number} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "invoice_number"} sortDirection={sortConfig?.direction} onSort={() => handleSort("invoice_number")} />
              )}
              {visibility.payment_percentage && (
                <ResizableTableHeader column="payment_percentage" label="Оплата" width={widths.payment_percentage} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "payment_percentage"} sortDirection={sortConfig?.direction} onSort={() => handleSort("payment_percentage")} />
              )}
              {visibility.shipment_date && (
                <ResizableTableHeader column="shipment_date" label="Отгрузка" width={widths.shipment_date} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "shipment_date"} sortDirection={sortConfig?.direction} onSort={() => handleSort("shipment_date")} />
              )}
              {visibility.delivery_date && (
                <ResizableTableHeader column="delivery_date" label="Приход" width={widths.delivery_date} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "delivery_date"} sortDirection={sortConfig?.direction} onSort={() => handleSort("delivery_date")} />
              )}
              {visibility.transport_company && (
                <ResizableTableHeader column="transport_company" label="ТК" width={widths.transport_company} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "transport_company"} sortDirection={sortConfig?.direction} onSort={() => handleSort("transport_company")} />
              )}
              {visibility.amount && (
                <ResizableTableHeader column="amount" label="Стоимость" width={widths.amount} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "amount"} sortDirection={sortConfig?.direction} onSort={() => handleSort("amount")} />
              )}
              {visibility.applicant && (
                <ResizableTableHeader column="applicant" label="Заявитель" width={widths.applicant} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "applicant"} sortDirection={sortConfig?.direction} onSort={() => handleSort("applicant")} />
              )}
              {visibility.comments && (
                <ResizableTableHeader column="comments" label="Комментарий" width={widths.comments} onResize={handleColumnResize} />
              )}
              <TableHead className="w-10 p-1 text-center">
                <MoreVertical className="h-3.5 w-3.5 mx-auto text-muted-foreground/50" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRequests.map((request, index) => {
              const priorityColor = request.priority === "Аварийно" 
                ? "#ef4444" 
                : request.priority === "Приоритетно" 
                  ? "#f97316" 
                  : "#d1d5db";
              
               const isEvenRow = index % 2 === 1;
               const rowNumber = startIndex + index + 1;
              
              return (
                  <TableRow
                  key={request.id}
                  className={`cursor-pointer transition-all duration-150 ease-out relative group hover:bg-muted/40 hover:shadow-sm active:scale-[0.998] active:bg-muted/60 ${isEvenRow ? 'bg-muted/10' : ''}`}
                  onClick={(e) => handleRowClick(request, e)}
                  onDoubleClick={(e) => handleRowDoubleClick(request, e)}
                  style={{ height: '40px' }}
                >
                  <TableCell 
                    className="w-[5px] p-0 border-r-0 transition-all duration-200 group-hover:brightness-125 group-hover:w-[6px]" 
                    style={{ 
                      backgroundColor: priorityColor,
                      borderRadius: '3px 0 0 3px',
                    }} 
                  />
                  <TableCell className="w-8 text-center px-1 py-1.5 border-r text-[11px] text-muted-foreground/60 font-mono sticky left-0 bg-inherit z-[1]">
                    {rowNumber}
                  </TableCell>
                  <TableCell className="w-10 text-center px-3 py-2 border-r" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedRequestIds.has(request.id)}
                      onCheckedChange={() => toggleRequestSelection(request.id)}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  {onToggleFavorite && (
                    <TableCell className="w-8 text-center px-1 py-2 border-r" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onToggleFavorite(request.id)}
                        className="hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            favoriteIds?.has(request.id)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30 hover:text-yellow-400"
                          }`}
                        />
                      </button>
                    </TableCell>
                  )}
                  <TableCell className="w-8 text-center px-1 py-2 border-r" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openQuickView(request)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                      title="Быстрый просмотр"
                    >
                      <Eye className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </button>
                  </TableCell>
                  {visibility.request_date && (
                    <TableCell className="text-center px-3 py-2 border-r text-muted-foreground overflow-hidden" style={{ width: widths.request_date }}>
                      {format(new Date(request.request_date), "dd.MM.yy")}
                    </TableCell>
                  )}
                  {visibility.description && (
                    <TableCell className="px-3 py-2 border-r overflow-hidden" style={{ width: widths.description }}>
                      <InlineEditCell
                        requestId={request.id}
                        field="description"
                        value={request.description}
                        displayValue={
                          <RequestQuickPreview
                            request={request}
                            getStatusColor={getStatusColor}
                            getPriorityColor={getPriorityColor}
                            onEdit={onEditClick}
                          >
                            <div className="line-clamp-1 hover:text-primary transition-colors font-medium leading-tight truncate" title={request.description}>
                              <HighlightText text={request.description} searchQuery={searchQuery} />
                            </div>
                          </RequestQuickPreview>
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.priority && (
                    <TableCell className="text-center px-3 py-2 border-r overflow-hidden" style={{ width: widths.priority }}>
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
                  )}
                  {visibility.status && (
                    <TableCell className="text-center px-3 py-2 border-r overflow-hidden" style={{ width: widths.status }}>
                      <InlineEditCell
                        requestId={request.id}
                        field="status"
                        value={request.status}
                        displayValue={
                          <Badge
                            className="text-xs px-2 py-0.5"
                            style={{
                              backgroundColor: getStatusColor(request.status),
                              color: "white",
                            }}
                          >
                            {request.status}
                          </Badge>
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.availability && (
                    <TableCell className="text-center px-3 py-2 border-r overflow-hidden" style={{ width: widths.availability }}>
                      {request.availability_delivery_time ? (
                        <div className="line-clamp-2 text-muted-foreground leading-tight truncate">
                          <HighlightText text={request.availability_delivery_time} searchQuery={searchQuery} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.contractor && (
                    <TableCell className="text-center px-3 py-2 border-r overflow-hidden" style={{ width: widths.contractor }}>
                      <InlineEditCell
                        requestId={request.id}
                        field="contractor"
                        value={request.contractor || ""}
                        displayValue={
                          request.contractor ? (
                            <div className="line-clamp-2 leading-tight truncate">
                              <HighlightText text={request.contractor} searchQuery={searchQuery} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.invoice_number && (
                    <TableCell className="text-center px-3 py-2 border-r overflow-hidden" style={{ width: widths.invoice_number }}>
                      {request.invoice_number ? (
                        <div className="line-clamp-2 text-muted-foreground leading-tight truncate">
                          <HighlightText text={request.invoice_number} searchQuery={searchQuery} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.payment_percentage && (
                    <TableCell className="text-center px-3 py-2 border-r font-semibold overflow-hidden" style={{ width: widths.payment_percentage }}>
                      <InlineEditCell
                        requestId={request.id}
                        field="payment_percentage"
                        value={request.payment_percentage}
                        displayValue={
                          request.payment_percentage !== null && request.payment_percentage !== undefined
                            ? <span className={request.payment_percentage === 100 ? "text-green-600" : "text-primary"}>{request.payment_percentage}%</span>
                            : <span className="text-muted-foreground/40">—</span>
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.shipment_date && (
                    <TableCell className="text-center px-3 py-2 border-r text-muted-foreground overflow-hidden" style={{ width: widths.shipment_date }}>
                      {request.shipment_date ? format(new Date(request.shipment_date), "dd.MM.yy") : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                  )}
                  {visibility.delivery_date && (
                    <TableCell className="text-center px-3 py-2 border-r text-muted-foreground overflow-hidden" style={{ width: widths.delivery_date }}>
                      <InlineEditCell
                        requestId={request.id}
                        field="delivery_date"
                        value={request.delivery_date || ""}
                        displayValue={
                          <span>{request.delivery_date ? format(new Date(request.delivery_date), "dd.MM.yy") : <span className="text-muted-foreground/40">—</span>}</span>
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.transport_company && (
                    <TableCell className="text-center px-3 py-2 border-r overflow-hidden" style={{ width: widths.transport_company }}>
                      <InlineEditCell
                        requestId={request.id}
                        field="transport_company"
                        value={request.transport_company || ""}
                        displayValue={
                          request.transport_company ? (
                            <div className="line-clamp-2 text-muted-foreground leading-tight truncate">
                              <HighlightText text={request.transport_company} searchQuery={searchQuery} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.amount && (
                    <TableCell className="text-center px-3 py-2 border-r overflow-hidden" style={{ width: widths.amount }}>
                      <InlineEditCell
                        requestId={request.id}
                        field="amount"
                        value={request.amount ?? ""}
                        displayValue={
                          request.amount && request.amount > 0 ? (
                            <span className="font-medium">
                              {new Intl.NumberFormat("ru-RU").format(Number(request.amount))} ₽
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.applicant && (
                    <TableCell className="text-center px-3 py-2 border-r overflow-hidden" style={{ width: widths.applicant }}>
                      <InlineEditCell
                        requestId={request.id}
                        field="applicant"
                        value={request.applicant || ""}
                        displayValue={
                          request.applicant ? (
                            <div className="line-clamp-2 leading-tight truncate">
                              <HighlightText text={request.applicant} searchQuery={searchQuery} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.comments && (
                    <TableCell className="text-center px-3 py-2 border-r overflow-hidden" style={{ width: widths.comments }}>
                      <InlineEditCell
                        requestId={request.id}
                        field="comments"
                        value={request.comments || ""}
                        displayValue={
                          request.comments ? (
                            <div className="line-clamp-3 text-muted-foreground italic leading-tight text-left">
                              <HighlightText text={request.comments} searchQuery={searchQuery} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {/* Row Action Menu */}
                  <TableCell className="w-10 text-center px-1 py-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => navigate(`/requests/${request.id}`)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Открыть заявку
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditClick?.(request)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicateClick?.(request)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Дублировать заявку
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCreateProcurement?.(request)}>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Создать поставку
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => onDeleteClick(request, e as unknown as React.MouseEvent)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <PaginationControls />
        </div>
      </div>
      </div>

      <RequestQuickView
        requestId={quickViewRequestId}
        open={quickViewOpen}
        onClose={closeQuickView}
        onEdit={onEditClick}
      />
    </div>
  );
};
