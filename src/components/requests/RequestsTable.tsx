import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Trash2, ChevronLeft, ChevronRight, Check, X, ChevronsLeft, ChevronsRight } from "lucide-react";
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

interface RequestsTableProps {
  requests: Request[] | undefined;
  isLoading: boolean;
  selectedRequestIds: Set<string>;
  toggleRequestSelection: (id: string) => void;
  toggleAllRequests: () => void;
  onDeleteClick: (request: Request, e: React.MouseEvent) => void;
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
  searchQuery = "",
}: RequestsTableProps) => {
  const navigate = useNavigate();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 25;
  });

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
  const totalItems = requests?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRequests = requests?.slice(startIndex, endIndex) || [];

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

      {/* Desktop Table View - Compact */}
      <div className="hidden lg:block rounded-md border overflow-x-auto">
        <Table className="w-full table-fixed text-xs">
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            <TableRow className="border-b hover:bg-transparent">
              <TableHead className="w-8 text-center p-1">
                <Checkbox
                  checked={selectedRequestIds.size === requests.length && requests.length > 0}
                  onCheckedChange={toggleAllRequests}
                  className="h-3.5 w-3.5"
                />
              </TableHead>
              <TableHead className="w-16 text-center p-1 font-semibold">Дата</TableHead>
              <TableHead className="min-w-[120px] p-1 font-semibold">Заявка</TableHead>
              <TableHead className="w-20 text-center p-1 font-semibold">Приоритет</TableHead>
              <TableHead className="w-24 text-center p-1 font-semibold">Статус</TableHead>
              <TableHead className="w-20 text-center p-1 font-semibold hidden xl:table-cell">Наличие</TableHead>
              <TableHead className="w-28 p-1 font-semibold">Контрагент</TableHead>
              <TableHead className="w-20 text-center p-1 font-semibold hidden xl:table-cell">Счёт</TableHead>
              <TableHead className="w-14 text-center p-1 font-semibold">%</TableHead>
              <TableHead className="w-16 text-center p-1 font-semibold hidden xl:table-cell">Отгр.</TableHead>
              <TableHead className="w-16 text-center p-1 font-semibold hidden xl:table-cell">Дост.</TableHead>
              <TableHead className="w-20 p-1 font-semibold hidden xl:table-cell">ТК</TableHead>
              <TableHead className="w-20 p-1 font-semibold hidden xl:table-cell">ТТН</TableHead>
              <TableHead className="w-24 p-1 font-semibold">Заявитель</TableHead>
              <TableHead className="min-w-[100px] p-1 font-semibold hidden xl:table-cell">Комм.</TableHead>
              <TableHead className="w-24 p-1 font-semibold hidden xl:table-cell">Исполн.</TableHead>
              <TableHead className="w-10 text-center p-1 font-semibold hidden xl:table-cell">КП</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRequests.map((request) => (
              <TableRow
                key={request.id}
                className="hover:bg-muted/40 cursor-pointer h-8 transition-colors"
                onClick={(e) => handleRowClick(request, e)}
              >
                <TableCell className="text-center p-1" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedRequestIds.has(request.id)}
                    onCheckedChange={() => toggleRequestSelection(request.id)}
                    className="h-3.5 w-3.5"
                  />
                </TableCell>
                <TableCell className="text-center p-1 text-muted-foreground">
                  {format(new Date(request.request_date), "dd.MM.yy")}
                </TableCell>
                <TableCell className="p-1">
                  <RequestQuickPreview
                    request={request}
                    getStatusColor={getStatusColor}
                    getPriorityColor={getPriorityColor}
                  >
                    <div className="line-clamp-1 hover:text-primary transition-colors font-medium">
                      <HighlightText text={request.description} searchQuery={searchQuery} />
                    </div>
                  </RequestQuickPreview>
                </TableCell>
                <TableCell className="text-center p-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5"
                    style={{
                      borderColor: getPriorityColor(request.priority || "Планово"),
                      color: getPriorityColor(request.priority || "Планово"),
                    }}
                  >
                    {request.priority || "Планово"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center p-1">
                  <Badge
                    className="text-[10px] px-1.5 py-0 h-5"
                    style={{
                      backgroundColor: getStatusColor(request.status),
                      color: "white",
                    }}
                  >
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell className="p-1 hidden xl:table-cell">
                  <div className="truncate text-muted-foreground">
                    <HighlightText text={request.availability_delivery_time || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="p-1">
                  <div className="truncate">
                    <HighlightText text={request.contractor || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="p-1 hidden xl:table-cell">
                  <div className="truncate text-muted-foreground">
                    <HighlightText text={request.invoice_number || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-center p-1 font-semibold">
                  {request.payment_percentage !== null && request.payment_percentage !== undefined
                    ? <span className={request.payment_percentage === 100 ? "text-green-600" : "text-primary"}>{request.payment_percentage}%</span>
                    : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-center p-1 hidden xl:table-cell text-muted-foreground">
                  {request.shipment_date ? format(new Date(request.shipment_date), "dd.MM") : "-"}
                </TableCell>
                <TableCell className="text-center p-1 hidden xl:table-cell text-muted-foreground">
                  {request.delivery_date ? format(new Date(request.delivery_date), "dd.MM") : "-"}
                </TableCell>
                <TableCell className="p-1 hidden xl:table-cell">
                  <div className="truncate text-muted-foreground">
                    <HighlightText text={request.transport_company || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="p-1 hidden xl:table-cell">
                  <div className="truncate text-muted-foreground">
                    <HighlightText text={request.waybill_number || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="p-1">
                  <div className="truncate">
                    <HighlightText text={request.applicant || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="p-1 hidden xl:table-cell">
                  <div className="truncate text-muted-foreground italic">
                    <HighlightText text={request.comments || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="p-1 hidden xl:table-cell">
                  <div className="truncate text-muted-foreground">
                    <HighlightText text={request.executor || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-center p-1 hidden xl:table-cell">
                  {request.document_url ? (
                    <Check className="h-3.5 w-3.5 text-green-600 mx-auto" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
                  )}
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
