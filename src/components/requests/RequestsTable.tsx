import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
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
import { RequestQuickPreview } from "@/components/RequestQuickPreview";
import { Request } from "@/hooks/useRequests";
import { getStatusColor, getPriorityColor } from "@/hooks/useRequestsFilters";

interface RequestsTableProps {
  requests: Request[] | undefined;
  isLoading: boolean;
  selectedRequestIds: Set<string>;
  toggleRequestSelection: (id: string) => void;
  toggleAllRequests: () => void;
  onDeleteClick: (request: Request, e: React.MouseEvent) => void;
}

export const RequestsTable = ({
  requests,
  isLoading,
  selectedRequestIds,
  toggleRequestSelection,
  toggleAllRequests,
  onDeleteClick,
}: RequestsTableProps) => {
  const navigate = useNavigate();

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

  return (
    <>
      {/* Mobile and Tablet Card View */}
      <div className="lg:hidden space-y-3">
        {requests.map((request) => (
          <Card
            key={request.id}
            className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) {
                handleRowClick(request, e);
              }
            }}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedRequestIds.has(request.id)}
                onCheckedChange={() => toggleRequestSelection(request.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 h-7 w-7 lg:h-4 lg:w-4"
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">
                      {format(new Date(request.request_date), "dd.MM.yy")}
                    </div>
                    <div className="font-medium text-sm line-clamp-2">
                      {request.description}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs"
                    style={{
                      borderColor: getPriorityColor(request.priority || "Планово"),
                      color: getPriorityColor(request.priority || "Планово"),
                    }}
                  >
                    {request.priority || "Планово"}
                  </Badge>
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: getStatusColor(request.status),
                      color: "white",
                    }}
                  >
                    {request.status}
                  </Badge>
                </div>

                {(request.contractor || request.applicant || request.executor) && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    {request.contractor && (
                      <div className="truncate">Контрагент: {request.contractor}</div>
                    )}
                    {request.applicant && (
                      <div className="truncate">Заявитель: {request.applicant}</div>
                    )}
                    {request.executor && (
                      <div className="truncate">Исполнитель: {request.executor}</div>
                    )}
                  </div>
                )}

                {request.comments && (
                  <div className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded">
                    {request.comments}
                  </div>
                )}

                <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                    onClick={(e) => onDeleteClick(request, e)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Исключить заявку
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
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
            {requests.map((request) => (
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
                      {request.description}
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
                  <div className="line-clamp-2">{request.availability_delivery_time || "-"}</div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 max-w-[120px]">
                  <div className="line-clamp-2">{request.contractor || "-"}</div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell">
                  <div className="line-clamp-2">{request.invoice_number || "-"}</div>
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
                  <div className="line-clamp-2">{request.transport_company || "-"}</div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell max-w-[100px]">
                  <div className="truncate">{request.waybill_number || "-"}</div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 max-w-[120px]">
                  <div className="line-clamp-2">{request.applicant || "-"}</div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell max-w-[150px]">
                  <div className="line-clamp-2">{request.comments || "-"}</div>
                </TableCell>
                <TableCell className="text-sm text-center border-r p-2 hidden xl:table-cell">
                  <div className="line-clamp-2">{request.executor || "-"}</div>
                </TableCell>
                <TableCell className="text-sm text-center p-2 hidden xl:table-cell">
                  <div className="line-clamp-2">{request.document_url ? "Есть" : "-"}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
};
