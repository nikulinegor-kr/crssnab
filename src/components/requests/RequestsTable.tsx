import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Trash2, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
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

  // Reset to page 1 when requests change (e.g., filters applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [requests?.length]);

  const handlePageSizeChange = (value: string) => {
    const newSize = parseInt(value, 10);
    setPageSize(newSize);
    localStorage.setItem(STORAGE_KEY, value);
    setCurrentPage(1);
  };

  const handleRowClick = (request: Request, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    navigate(`/requests/${request.id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 sm:h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium">Заявки не найдены</p>
        <p className="text-muted-foreground">
          Попробуйте изменить фильтры или импортировать данные
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

  // Pagination UI component
  const PaginationControls = () => (
    <div className="flex flex-col xs:flex-row items-center justify-between gap-2 py-2 sm:py-3 border-t mt-2 sm:mt-4">
      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
        <span>Показывать:</span>
        <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
          <SelectTrigger className="w-16 sm:w-20 h-7 sm:h-8 text-xs sm:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden xs:inline">
          из {totalItems}
        </span>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2">
        <span className="text-xs sm:text-sm text-muted-foreground">
          {startIndex + 1}-{Math.min(endIndex, totalItems)} из {totalItems}
        </span>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 -ml-2" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <span className="px-2 text-xs sm:text-sm font-medium min-w-[3rem] text-center">
            {currentPage} / {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 -ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile and Tablet Card View */}
      <div className="lg:hidden space-y-2 sm:space-y-3">
        {paginatedRequests.map((request) => (
          <Card
            key={request.id}
            className="p-2.5 sm:p-4 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) {
                handleRowClick(request, e);
              }
            }}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <Checkbox
                checked={selectedRequestIds.has(request.id)}
                onCheckedChange={() => toggleRequestSelection(request.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 h-5 w-5 sm:h-6 sm:w-6"
              />
              <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      {format(new Date(request.request_date), "dd.MM.yy")}
                    </div>
                    <div className="font-medium text-xs sm:text-sm line-clamp-2">
                      <HighlightText text={request.description} searchQuery={searchQuery} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 sm:gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] sm:text-xs px-1.5 py-0 sm:px-2 sm:py-0.5"
                    style={{
                      borderColor: getPriorityColor(request.priority || "Планово"),
                      color: getPriorityColor(request.priority || "Планово"),
                    }}
                  >
                    {request.priority || "Планово"}
                  </Badge>
                  <Badge
                    className="text-[10px] sm:text-xs px-1.5 py-0 sm:px-2 sm:py-0.5"
                    style={{
                      backgroundColor: getStatusColor(request.status),
                      color: "white",
                    }}
                  >
                    {request.status}
                  </Badge>
                </div>

                {(request.contractor || request.applicant || request.executor) && (
                  <div className="text-[10px] sm:text-xs text-muted-foreground space-y-0.5">
                    {request.contractor && (
                      <div className="truncate">К: <HighlightText text={request.contractor} searchQuery={searchQuery} /></div>
                    )}
                    {request.applicant && (
                      <div className="truncate">З: <HighlightText text={request.applicant} searchQuery={searchQuery} /></div>
                    )}
                    {request.executor && (
                      <div className="truncate">И: <HighlightText text={request.executor} searchQuery={searchQuery} /></div>
                    )}
                  </div>
                )}

                {request.comments && (
                  <div className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-1.5 sm:p-2 rounded">
                    <HighlightText text={request.comments} searchQuery={searchQuery} />
                  </div>
                )}

                <div className="pt-1.5 sm:pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 h-7 sm:h-8 text-xs"
                    onClick={(e) => onDeleteClick(request, e)}
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    В архив
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        <PaginationControls />
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block rounded-md border overflow-x-auto">
        <Table className="w-full table-auto border-collapse">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="bg-muted/50 border-b">
              <TableHead className="w-10 text-center border-r p-2">
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={selectedRequestIds.size === requests.length && requests.length > 0}
                    onCheckedChange={toggleAllRequests}
                  />
                </div>
              </TableHead>
              <TableHead className="text-center border-r p-2 text-sm">Дата</TableHead>
              <TableHead className="text-center border-r p-2 text-sm">Заявка</TableHead>
              <TableHead className="text-center border-r p-2 text-sm">Приоритет</TableHead>
              <TableHead className="text-center border-r p-2 text-sm">Статус</TableHead>
              <TableHead className="text-center border-r p-2 text-sm hidden xl:table-cell">Наличие</TableHead>
              <TableHead className="text-center border-r p-2 text-sm">Контрагент</TableHead>
              <TableHead className="text-center border-r p-2 text-sm hidden xl:table-cell">Счёт</TableHead>
              <TableHead className="text-center border-r p-2 text-sm">Оплата</TableHead>
              <TableHead className="text-center border-r p-2 text-sm hidden xl:table-cell">ДатаО</TableHead>
              <TableHead className="text-center border-r p-2 text-sm hidden xl:table-cell">ДатаД</TableHead>
              <TableHead className="text-center border-r p-2 text-sm hidden xl:table-cell">ТК</TableHead>
              <TableHead className="text-center border-r p-2 text-sm hidden xl:table-cell">№ ТТН</TableHead>
              <TableHead className="text-center border-r p-2 text-sm">Заявитель</TableHead>
              <TableHead className="text-center border-r p-2 text-sm hidden xl:table-cell">Комментарий</TableHead>
              <TableHead className="text-center border-r p-2 text-sm hidden xl:table-cell">Исполнитель</TableHead>
              <TableHead className="text-center p-2 text-sm hidden xl:table-cell">Счёт/КП</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRequests.map((request) => (
              <TableRow
                key={request.id}
                className="hover:bg-muted/30 cursor-pointer border-b"
                onClick={(e) => handleRowClick(request, e)}
              >
                <TableCell className="text-sm text-center border-r p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={selectedRequestIds.has(request.id)}
                      onCheckedChange={() => toggleRequestSelection(request.id)}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2">
                  <div className="line-clamp-2">
                    {format(new Date(request.request_date), "dd.MM.yy")}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 max-w-[150px]">
                  <RequestQuickPreview
                    request={request}
                    getStatusColor={getStatusColor}
                    getPriorityColor={getPriorityColor}
                  >
                    <div className="line-clamp-2 hover:text-primary transition-colors cursor-pointer">
                      <HighlightText text={request.description} searchQuery={searchQuery} />
                    </div>
                  </RequestQuickPreview>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2">
                  <Badge
                    variant="outline"
                    className="whitespace-nowrap text-xs px-2 py-1"
                    style={{
                      borderColor: getPriorityColor(request.priority || "Планово"),
                      color: getPriorityColor(request.priority || "Планово"),
                    }}
                  >
                    {request.priority || "Планово"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2">
                  <Badge
                    className="whitespace-nowrap text-xs px-2 py-1"
                    style={{
                      backgroundColor: getStatusColor(request.status),
                      color: "white",
                    }}
                  >
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell">
                  <div className="line-clamp-2">
                    <HighlightText text={request.availability_delivery_time || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 max-w-[120px]">
                  <div className="line-clamp-2">
                    <HighlightText text={request.contractor || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell">
                  <div className="line-clamp-2">
                    <HighlightText text={request.invoice_number || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2">
                  <div className="line-clamp-2">
                    {request.payment_percentage !== null && request.payment_percentage !== undefined
                      ? `${request.payment_percentage}%`
                      : "-"}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell">
                  <div className="line-clamp-2">
                    {request.shipment_date ? format(new Date(request.shipment_date), "dd.MM.yy") : "-"}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell">
                  <div className="line-clamp-2">
                    {request.delivery_date ? format(new Date(request.delivery_date), "dd.MM.yy") : "-"}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell">
                  <div className="line-clamp-2">
                    <HighlightText text={request.transport_company || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell max-w-[100px]">
                  <div className="truncate">
                    <HighlightText text={request.waybill_number || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 max-w-[120px]">
                  <div className="line-clamp-2">
                    <HighlightText text={request.applicant || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell max-w-[150px]">
                  <div className="line-clamp-2">
                    <HighlightText text={request.comments || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell">
                  <div className="line-clamp-2">
                    <HighlightText text={request.executor || "-"} searchQuery={searchQuery} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-center p-2 hidden xl:table-cell">
                  <div className="flex items-center justify-center">
                    {request.document_url ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/50" />
                    )}
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
