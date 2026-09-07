import React, { useState, useEffect, useCallback, useRef, memo, useMemo, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Star, Eye, MoreVertical, ExternalLink, Pencil, Copy, ShoppingCart, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, MapPin, Layers, Tag, FolderOpen, Loader2 } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { ShipmentsSummaryChips } from "./RequestShipmentsPanel";
import { RequestShipmentsTree, ShipmentsProgressChip } from "./RequestShipmentsTree";
import { useShipmentsSummary } from "@/hooks/useRequestShipments";
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
import { useTableColumnWidths, ColumnWidths, DEFAULT_COLUMN_WIDTHS } from "@/hooks/useTableColumnWidths";
import { ResizableTableHeader } from "./ResizableTableHeader";
import { InlineEditCell } from "./InlineEditCell";
import { QuickBadgeSelect } from "./QuickBadgeSelect";
import { InlineObjectCell } from "./InlineObjectCell";
import { InlineExecutorCell } from "./InlineExecutorCell";
import { InlinePaymentStatusCell } from "./InlinePaymentStatusCell";
import { RequestQuickView } from "./RequestQuickView";
import { LabelPrintDialog } from "@/components/request/LabelPrintDialog";
import { useProjectOptions } from "@/hooks/useProjects";
import { useAuthUserId } from "@/hooks/useOrgMembership";
import { isBefore, startOfToday } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { STATUSES, PRIORITIES } from "@/hooks/useRequestsFilters";


const moneyShort = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " \u20BD";

const DELIVERED_ST = ["Доставлено", "Выполнено", "Завершено"];
const TRANSIT_ST = ["В пути", "Доставлено в ТК", "Отгружено"];

function summarizeGroup(items: any[]) {
  const now = new Date();
  const suppliers = new Set<string>();
  let amount = 0, paid = 0, invoices = 0, delivered = 0, inTransit = 0, overdue = 0, emergency = 0;
  for (const r of items) {
    const total = (Number(r.amount) || 0) + (Number(r.amount_2) || 0) + (Number(r.amount_3) || 0);
    amount += total;
    paid += (total * (Number(r.payment_percent) || 0)) / 100;
    invoices += [r.invoice_number, r.invoice_number_2, r.invoice_number_3].filter((v: any) => v && String(v).trim()).length;
    if (r.contractor?.trim()) suppliers.add(r.contractor.trim().toLowerCase());
    const isDelivered = DELIVERED_ST.includes(r.status);
    if (isDelivered) delivered += 1;
    else if (TRANSIT_ST.includes(r.status)) inTransit += 1;
    if (!isDelivered && r.delivery_date && new Date(r.delivery_date) < now) overdue += 1;
    if (r.priority === "Аварийно") emergency += 1;
  }
  const total = items.length;
  const progress = total ? Math.round((delivered / total) * 100) : 0;
  let computedStatus = "В работе";
  if (!total) computedStatus = "Нет заявок";
  else if (delivered === total) computedStatus = "Проект завершён";
  else if (emergency > 0) computedStatus = "Аварийная ситуация";
  else if (inTransit > 0) computedStatus = "В пути";
  else if (paid < amount - 0.5) computedStatus = "Ожидает оплаты";
  return { total, suppliers: suppliers.size, invoices, amount, paid, unpaid: Math.max(amount - paid, 0), delivered, inTransit, overdue, emergency, progress, computedStatus };
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const STORAGE_KEY = "requests-page-size";
const SORT_STORAGE_KEY = "requests-sort";
const DENSITY_STORAGE_KEY = "requests-table-density";

type RowDensity = "compact" | "normal" | "roomy";

const statusDotClass = (status: string) => {
  if (["Доставлено", "Выполнено", "Доставлено в ТК"].includes(status)) return "bg-success";
  if (["В пути"].includes(status)) return "bg-primary";
  if (["Готов к отгрузке", "На согласовании", "В работе"].includes(status)) return "bg-info";
  if (["КП", "Запрос КП", "Ожидание КП", "Счёт", "Счёт в Бухгалтерии", "Счёт в бухгалтерии", "Обновить счёт"].includes(status)) return "bg-warning";
  return "bg-muted-foreground";
};


type SortField = 
  | "request_date" 
  | "description" 
  | "object"
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
  activeRequestId?: string | null;
  onRequestOrderChange?: (requests: Request[]) => void;
  onClearSelection?: () => void;

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
          <span className="text-xs text-muted-foreground font-medium">
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

        {/* Object */}
        {(request as any).object_name && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              <HighlightText text={(request as any).object_name} searchQuery={searchQuery} />
            </span>
          </div>
        )}

        {/* Compact info row */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
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
          {(() => {
            const pct = (request as any).payment_percent ?? request.payment_percentage ?? 0;
            if (pct === 0) return null;
            if (pct >= 100) return <span className="font-semibold text-success">Оплачено</span>;
            return <span className="font-semibold text-warning">{pct}%</span>;
          })()}
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
        onClick={onDelete}
        aria-label="Архивировать заявку"
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
  activeRequestId,
  onRequestOrderChange,
  onClearSelection,
}: RequestsTableProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [bulkSaving, setBulkSaving] = useState(false);

  const applyBulk = useCallback(async (field: "status" | "priority", value: string) => {
    const ids = Array.from(selectedRequestIds);
    if (!ids.length) return;
    setBulkSaving(true);
    try {
      const { error } = await supabase.from("requests").update({ [field]: value }).in("id", ids);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({
        title: field === "status" ? "Статус изменён" : "Приоритет изменён",
        description: `Заявок: ${ids.length} · ${value}`,
      });
    } catch (e) {
      console.error("Bulk update:", e);
      toast({ title: "Не удалось сохранить", description: "Изменения не применены", variant: "destructive" });
    } finally {
      setBulkSaving(false);
    }
  }, [queryClient, selectedRequestIds, toast]);

  const { data: userId } = useAuthUserId();
  const { visibility, updateVisibility, resetToDefaults } = useTableColumnVisibility(userId);
  const { widths, updateWidth, resetToDefaults: resetColumnWidths } = useTableColumnWidths();
  const [density, setDensity] = useState<RowDensity>(() => {
    const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
    return saved === "normal" || saved === "roomy" ? saved : "compact";
  });
  
  // Quick View state — only store ID to avoid re-renders from table data updates
  const [quickViewRequestId, setQuickViewRequestId] = useState<string | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  // Меню статуса/приоритета (клик по ячейке либо клавиши S / P)
  const [openMenu, setOpenMenu] = useState<{ id: string; field: "status" | "priority" } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape") {
        setOpenMenu(null);
        return;
      }
      if (!activeRequestId || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s" || key === "ы") {
        event.preventDefault();
        setOpenMenu({ id: activeRequestId, field: "status" });
      } else if (key === "p" || key === "з") {
        event.preventDefault();
        setOpenMenu({ id: activeRequestId, field: "priority" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeRequestId]);


  const openQuickView = useCallback((request: Request) => {
    setQuickViewRequestId(request.id);
    setQuickViewOpen(true);
  }, []);

  const closeQuickView = useCallback(() => {
    setQuickViewOpen(false);
  }, []);

  // Label print dialog state
  const [labelRequest, setLabelRequest] = useState<Request | null>(null);
  const openLabelPrint = useCallback((request: Request) => {
    setLabelRequest(request);
  }, []);
  const closeLabelPrint = useCallback(() => {
    setLabelRequest(null);
  }, []);

  const handleColumnResize = useCallback((column: string, width: number) => {
    updateWidth(column as keyof ColumnWidths, width);
  }, [updateWidth]);

  // Group by object
  const [groupByObject, setGroupByObject] = useState<boolean>(() => {
    return localStorage.getItem("requests-group-by-object") === "1";
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroupByObject = useCallback((v: boolean) => {
    setGroupByObject(v);
    localStorage.setItem("requests-group-by-object", v ? "1" : "0");
    if (v) {
      setGroupByProject(false);
      localStorage.setItem("requests-group-by-project", "0");
    }
  }, []);
  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Group by project (родительская заявка → дочерние)
  const [groupByProject, setGroupByProject] = useState<boolean>(() => {
    return localStorage.getItem("requests-group-by-project") === "1";
  });
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const toggleGroupByProject = useCallback((v: boolean) => {
    setGroupByProject(v);
    localStorage.setItem("requests-group-by-project", v ? "1" : "0");
    if (v) {
      setGroupByObject(false);
      localStorage.setItem("requests-group-by-object", "0");
    }
  }, []);
  const toggleProject = useCallback((key: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const { data: projectOptions = [] } = useProjectOptions();
  const projectNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projectOptions) m.set(p.id, p.description || p.request_number);
    return m;
  }, [projectOptions]);

  // Shipments tree expansion (moved above early returns to satisfy hooks rules)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

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
      let aVal: any;
      let bVal: any;

      if (field === "object") {
        aVal = (a as any).object_name;
        bVal = (b as any).object_name;
      } else {
        aVal = a[field];
        bVal = b[field];
      }

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
    if ((e.target as HTMLElement).closest('input[type="checkbox"], button, [role="button"]')) return;
    onEditClick?.(request);
  }, [onEditClick]);

  const handleDesktopRowClick = useCallback((request: Request, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-row-action]")) return;
    e.preventDefault();
    e.stopPropagation();
    onEditClick?.(request);
  }, [onEditClick]);

  const handleRowDoubleClick = useCallback((request: Request, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
    // Double click inside an inline-editable cell starts editing, not quick view
    if ((e.target as HTMLElement).closest('[data-inline-edit]')) return;
    e.preventDefault();
  }, []);


  // Pagination calculations — disabled in grouped mode (show all)
  const grouped = groupByObject || groupByProject;
  const totalItems = sortedRequests?.length || 0;
  const filteredTotal = useMemo(() => (sortedRequests || []).reduce(
    (sum, request) => sum + Number(request.amount || 0) + Number((request as any).amount_2 || 0) + Number((request as any).amount_3 || 0),
    0
  ), [sortedRequests]);
  const effectivePageSize = grouped ? Math.max(totalItems, 1) : pageSize;
  const totalPages = grouped ? 1 : Math.ceil(totalItems / pageSize);
  const startIndex = grouped ? 0 : (currentPage - 1) * pageSize;
  const endIndex = startIndex + effectivePageSize;
  const paginatedRequests = sortedRequests?.slice(startIndex, endIndex) || [];

  useEffect(() => {
    onRequestOrderChange?.(paginatedRequests);
  }, [onRequestOrderChange, paginatedRequests]);

  // Group by object — must stay before early returns to keep hook order stable
  const groupedRequests = useMemo(() => {
    if (!groupByObject) return null;
    const groups = new Map<string, { key: string; name: string; items: typeof paginatedRequests }>();
    for (const r of paginatedRequests) {
      const name = (r as any).object_name || "Без объекта";
      const key = (r as any).object_id || "__none__";
      if (!groups.has(key)) groups.set(key, { key, name, items: [] });
      groups.get(key)!.items.push(r);
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [groupByObject, paginatedRequests]);

  // Group by project (родительская заявка)
  const projectGroups = useMemo(() => {
    if (!groupByProject) return null;
    const groups = new Map<string, { key: string; name: string; items: typeof paginatedRequests }>();
    const loose: typeof paginatedRequests = [];
    for (const r of paginatedRequests) {
      const pid = (r as any).parent_request_id as string | null;
      if (!pid) { loose.push(r); continue; }
      const name = projectNames.get(pid) || "Проект";
      if (!groups.has(pid)) groups.set(pid, { key: pid, name, items: [] });
      groups.get(pid)!.items.push(r);
    }
    const list = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return { list, loose };
  }, [groupByProject, paginatedRequests, projectNames]);

  const visibleIds = useMemo(() => paginatedRequests.map((r) => r.id), [paginatedRequests]);
  const { data: shipmentsSummary } = useShipmentsSummary(visibleIds);

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

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Compact Pagination UI
  const PaginationControls = () => (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-2 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
          <SelectTrigger className="w-14 h-6 text-xs px-2">
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
        <span className="mx-1 h-4 w-px bg-border" />
        <span>Сумма:</span>
        <strong className="font-numeric font-semibold text-foreground">{moneyShort(filteredTotal)}</strong>
      </div>
      
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">
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
        <span className="text-xs font-medium px-1 min-w-[2.5rem] text-center">
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
      <div className="flex items-center gap-1" aria-label="Плотность строк">
        {([
          ["compact", "Плотно"],
          ["normal", "Обычно"],
          ["roomy", "Свободно"],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={density === value ? "secondary" : "ghost"}
            className="h-6 px-2 text-xs"
            onClick={() => {
              setDensity(value);
              localStorage.setItem(DENSITY_STORAGE_KEY, value);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex gap-2 items-start" data-density={density}>
      <div className="flex-1 min-w-0">
      {/* Mobile View - Compact Cards */}
      <div className="lg:hidden space-y-1.5">
        <div className="flex justify-end gap-1 pb-1">
          <Toggle
            pressed={groupByProject}
            onPressedChange={toggleGroupByProject}
            size="sm"
            className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            По проектам
          </Toggle>
          <Toggle
            pressed={groupByObject}
            onPressedChange={toggleGroupByObject}
            size="sm"
            className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <Layers className="h-3.5 w-3.5" />
            По объектам
          </Toggle>
        </div>
        {groupByProject && projectGroups ? (
          <>
            {projectGroups.list.map((g) => {
              const open = expandedProjects.has(g.key);
              const s = summarizeGroup(g.items);
              return (
                <div key={g.key} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => toggleProject(g.key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 bg-muted/70 rounded text-xs font-semibold"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
                    <FolderOpen className="h-3.5 w-3.5 text-primary" />
                    <span className="truncate">{g.name}</span>
                    <span className="ml-auto text-muted-foreground font-normal">
                      {s.total} · {moneyShort(s.amount)}
                    </span>
                  </button>
                  {open && g.items.map((request) => (
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
                </div>
              );
            })}
            {projectGroups.loose.map((request) => (
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
          </>
        ) : groupByObject && groupedRequests ? (
          groupedRequests.map((g) => {
            const collapsed = collapsedGroups.has(g.key);
            return (
              <div key={g.key} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(g.key)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 bg-muted/70 rounded text-xs font-semibold"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate">{g.name}</span>
                  <span className="ml-auto text-muted-foreground font-normal">{g.items.length}</span>
                </button>
                {!collapsed && g.items.map((request) => (
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
              </div>
            );
          })
        ) : (
          paginatedRequests.map((request) => (
            <MobileRequestCard
              key={request.id}
              request={request}
              isSelected={selectedRequestIds.has(request.id)}
              onToggleSelection={() => toggleRequestSelection(request.id)}
              onRowClick={(e) => handleRowClick(request, e)}
              onDelete={(e) => onDeleteClick(request, e)}
              searchQuery={searchQuery}
            />
          ))
        )}
        <PaginationControls />
      </div>

      {/* Desktop Table View */}
      <div
        className="hidden lg:block"
        onMouseOver={(e) => {
          // Тултип только когда текст реально не поместился
          const cell = (e.target as HTMLElement)?.closest?.("td") as HTMLTableCellElement | null;
          if (!cell) return;
          const overflowing = cell.scrollWidth > cell.clientWidth + 1;
          const text = cell.innerText?.trim();
          if (overflowing && text) cell.title = text;
          else cell.removeAttribute("title");
        }}
      >

        <div className="flex items-center justify-end gap-1 border-b border-border bg-card px-2 py-1">
          <Toggle
            pressed={groupByProject}
            onPressedChange={toggleGroupByProject}
            size="sm"
            aria-label="Группировать по проектам"
            className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Проекты
          </Toggle>
          <Toggle
            pressed={groupByObject}
            onPressedChange={toggleGroupByObject}
            size="sm"
            aria-label="Группировать по объектам"
            className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <Layers className="h-3.5 w-3.5" />
            Группировать по объектам
          </Toggle>
          {headerActions}
          <TableColumnSettings visibility={visibility} onVisibilityChange={updateVisibility} onReset={resetToDefaults} />
        </div>
        <div className="border-0 bg-card">
        <Table className="w-full min-w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: visibility.select === false ? 8 : 32 }} />
            {visibility.request_date && <col style={{ width: widths.request_date }} />}
            {visibility.description && <col style={{ width: widths.description }} />}
            {visibility.object && <col style={{ width: widths.object }} />}
            {visibility.status && <col style={{ width: widths.status }} />}
            {visibility.availability && <col style={{ width: widths.availability }} />}
            {visibility.contractor && <col style={{ width: widths.contractor }} />}
            {visibility.amount && <col style={{ width: widths.amount }} />}
            {visibility.invoice_number && <col style={{ width: widths.invoice_number }} />}
            {visibility.payment_prepay && <col style={{ width: widths.payment_prepay }} />}
            {visibility.payment_percentage && <col style={{ width: widths.payment_percentage }} />}
            {visibility.shipment_date && <col style={{ width: widths.shipment_date }} />}
            {visibility.delivery_date && <col style={{ width: widths.delivery_date }} />}
            {visibility.transport_company && <col style={{ width: widths.transport_company }} />}
            {visibility.waybill_number && <col style={{ width: widths.waybill_number }} />}
            {visibility.applicant && <col style={{ width: widths.applicant }} />}
            {visibility.executor && <col style={{ width: widths.executor }} />}
            {visibility.equipment && <col style={{ width: widths.equipment }} />}
            {visibility.comments && <col style={{ width: widths.comments }} />}
            <col style={{ width: 40 }} />
          </colgroup>
          <TableHeader className="bg-muted [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-muted">
            <TableRow className="border-b border-border hover:bg-transparent" style={{ height: 'var(--row-h)' }}>
              <TableHead className="text-center p-1 border-b">
                {visibility.select !== false && (
                  <Checkbox
                    checked={selectedRequestIds.size === requests.length && requests.length > 0}
                    onCheckedChange={toggleAllRequests}
                    className="h-4 w-4"
                  />
                )}
              </TableHead>
              {visibility.request_date && (
                <ResizableTableHeader column="request_date" label="Дата" width={widths.request_date} defaultWidth={DEFAULT_COLUMN_WIDTHS.request_date} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "request_date"} sortDirection={sortConfig?.direction} onSort={() => handleSort("request_date")} />
              )}
              {visibility.description && (
                <ResizableTableHeader column="description" defaultWidth={DEFAULT_COLUMN_WIDTHS.description} label="Заявка" width={widths.description} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "description"} sortDirection={sortConfig?.direction} onSort={() => handleSort("description")} />
              )}
              {visibility.object && (
                <ResizableTableHeader align="left" column="object" defaultWidth={DEFAULT_COLUMN_WIDTHS.object} label="Объект" width={widths.object} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "object"} sortDirection={sortConfig?.direction} onSort={() => handleSort("object")} />
              )}
              {visibility.status && (
                <ResizableTableHeader align="left" column="status" defaultWidth={DEFAULT_COLUMN_WIDTHS.status} label="Статус" width={widths.status} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "status"} sortDirection={sortConfig?.direction} onSort={() => handleSort("status")} />
              )}
              {visibility.availability && (
                <ResizableTableHeader column="availability" defaultWidth={DEFAULT_COLUMN_WIDTHS.availability} label="Наличие" width={widths.availability} onResize={handleColumnResize} />
              )}
              {visibility.contractor && (
                <ResizableTableHeader align="left" column="contractor" defaultWidth={DEFAULT_COLUMN_WIDTHS.contractor} label="Контрагент" width={widths.contractor} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "contractor"} sortDirection={sortConfig?.direction} onSort={() => handleSort("contractor")} />
              )}
              {visibility.amount && (
                <ResizableTableHeader align="right" column="amount" defaultWidth={DEFAULT_COLUMN_WIDTHS.amount} label="Сумма" width={widths.amount} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "amount"} sortDirection={sortConfig?.direction} onSort={() => handleSort("amount")} />
              )}
              {visibility.invoice_number && (
                <ResizableTableHeader column="invoice_number" defaultWidth={DEFAULT_COLUMN_WIDTHS.invoice_number} label="Счёт" width={widths.invoice_number} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "invoice_number"} sortDirection={sortConfig?.direction} onSort={() => handleSort("invoice_number")} />
              )}
              {visibility.payment_prepay && (
                <ResizableTableHeader column="payment_prepay" defaultWidth={DEFAULT_COLUMN_WIDTHS.payment_prepay} label="% предопл." width={widths.payment_prepay} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "payment_percentage"} sortDirection={sortConfig?.direction} onSort={() => handleSort("payment_percentage")} />
              )}
              {visibility.payment_percentage && (
                <ResizableTableHeader column="payment_percentage" defaultWidth={DEFAULT_COLUMN_WIDTHS.payment_percentage} label="Факт опл." width={widths.payment_percentage} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "payment_percentage"} sortDirection={sortConfig?.direction} onSort={() => handleSort("payment_percentage")} />
              )}
              {visibility.shipment_date && (
                <ResizableTableHeader column="shipment_date" defaultWidth={DEFAULT_COLUMN_WIDTHS.shipment_date} label="Отгрузка" width={widths.shipment_date} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "shipment_date"} sortDirection={sortConfig?.direction} onSort={() => handleSort("shipment_date")} />
              )}
              {visibility.delivery_date && (
                <ResizableTableHeader column="delivery_date" defaultWidth={DEFAULT_COLUMN_WIDTHS.delivery_date} label="Приход" width={widths.delivery_date} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "delivery_date"} sortDirection={sortConfig?.direction} onSort={() => handleSort("delivery_date")} />
              )}
              {visibility.transport_company && (
                <ResizableTableHeader column="transport_company" defaultWidth={DEFAULT_COLUMN_WIDTHS.transport_company} label="ТК" width={widths.transport_company} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "transport_company"} sortDirection={sortConfig?.direction} onSort={() => handleSort("transport_company")} />
              )}
              {visibility.waybill_number && (
                <ResizableTableHeader column="waybill_number" defaultWidth={DEFAULT_COLUMN_WIDTHS.waybill_number} label="№ТТН" width={widths.waybill_number} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "waybill_number"} sortDirection={sortConfig?.direction} onSort={() => handleSort("waybill_number")} />
              )}
              {visibility.applicant && (
                <ResizableTableHeader align="left" column="applicant" defaultWidth={DEFAULT_COLUMN_WIDTHS.applicant} label="Заявитель" width={widths.applicant} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "applicant"} sortDirection={sortConfig?.direction} onSort={() => handleSort("applicant")} />
              )}
              {visibility.executor && (
                <ResizableTableHeader align="left" column="executor" defaultWidth={DEFAULT_COLUMN_WIDTHS.executor} label="Кто ведёт" width={widths.executor} onResize={handleColumnResize} sortable isActive={sortConfig?.field === "executor"} sortDirection={sortConfig?.direction} onSort={() => handleSort("executor")} />
              )}
              {visibility.equipment && (
                <ResizableTableHeader column="equipment" defaultWidth={DEFAULT_COLUMN_WIDTHS.equipment} label="Техника" width={widths.equipment} onResize={handleColumnResize} />
              )}
              {visibility.comments && (
                <ResizableTableHeader column="comments" defaultWidth={DEFAULT_COLUMN_WIDTHS.comments} label="Комментарий" width={widths.comments} onResize={handleColumnResize} />
              )}
              <TableHead className="w-10 p-1 text-center">
                <MoreVertical className="h-3.5 w-3.5 mx-auto text-muted-foreground/50" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              type Item =
                | { kind: "group"; key: string; name: string; items: typeof paginatedRequests }
                | { kind: "project"; key: string; name: string; items: typeof paginatedRequests }
                | { kind: "row"; request: typeof paginatedRequests[number]; index: number; child?: boolean };
              const items: Item[] = [];
              if (groupByProject && projectGroups) {
                let idx = 0;
                for (const g of projectGroups.list) {
                  items.push({ kind: "project", key: g.key, name: g.name, items: g.items });
                  if (expandedProjects.has(g.key)) {
                    for (const r of g.items) {
                      items.push({ kind: "row", request: r, index: idx++, child: true });
                    }
                  } else {
                    idx += g.items.length;
                  }
                }
                for (const r of projectGroups.loose) {
                  items.push({ kind: "row", request: r, index: idx++ });
                }
              } else if (groupByObject && groupedRequests) {
                let idx = 0;
                for (const g of groupedRequests) {
                  items.push({ kind: "group", key: g.key, name: g.name, items: g.items });
                  if (!collapsedGroups.has(g.key)) {
                    for (const r of g.items) {
                      items.push({ kind: "row", request: r, index: idx++ });
                    }
                  } else {
                    idx += g.items.length;
                  }
                }
              } else {
                paginatedRequests.forEach((r, i) => items.push({ kind: "row", request: r, index: i }));
              }
              return items.map((it) => {
                if (it.kind === "group") {
                  const counts = it.items.reduce(
                    (acc, r) => {
                      acc.total += 1;
                      if (r.priority === "Аварийно") acc.emergency += 1;
                      else if (r.priority === "Приоритетно") acc.priority += 1;
                      else acc.planned += 1;
                      if (r.status === "В работе") acc.inWork += 1;
                      if (r.status === "Доставлено") acc.delivered += 1;
                      acc.amount += Number(r.amount || 0);
                      return acc;
                    },
                    { total: 0, emergency: 0, priority: 0, planned: 0, inWork: 0, delivered: 0, amount: 0 }
                  );
                  const collapsed = collapsedGroups.has(it.key);
                  return (
                    <TableRow
                      key={`grp-${it.key}`}
                      className="bg-accent/70 hover:bg-accent cursor-pointer border-y border-border"
                      onClick={() => toggleGroup(it.key)}
                    >
                      <TableCell colSpan={100} className="px-2 py-1.5">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-foreground">{it.name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{counts.total} заявок</span>
                          {counts.emergency > 0 && <span className="text-destructive font-medium">🔴 {counts.emergency} ав.</span>}
                          {counts.priority > 0 && <span className="text-warning font-medium">🟠 {counts.priority} приор.</span>}
                          {counts.planned > 0 && <span className="text-info font-medium">🔵 {counts.planned} плановых</span>}
                          {counts.inWork > 0 && <span className="text-muted-foreground">⚙ {counts.inWork} в работе</span>}
                          {counts.delivered > 0 && <span className="text-success">✓ {counts.delivered} доставлено</span>}
                          {counts.amount > 0 && (
                            <span className="ml-auto font-numeric font-semibold text-foreground">
                              {new Intl.NumberFormat("ru-RU").format(Math.round(counts.amount))} ₽
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }
                if (it.kind === "project") {
                  const s = summarizeGroup(it.items);
                  const open = expandedProjects.has(it.key);
                  return (
                    <TableRow
                      key={`prj-${it.key}`}
                      className="bg-primary/5 hover:bg-primary/10 cursor-pointer border-y-2 border-primary/30"
                      onClick={() => toggleProject(it.key)}
                    >
                      <TableCell colSpan={100} className="px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
                          <FolderOpen className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-foreground">{it.name}</span>
                          <Badge variant="outline" className="text-[10px]">{s.computedStatus}</Badge>
                          <span className="text-muted-foreground">📦 {s.total}</span>
                          <span className="text-muted-foreground">🏢 {s.suppliers}</span>
                          <span className="text-muted-foreground">🧾 {s.invoices}</span>
                          {s.inTransit > 0 && <span className="text-info">🚛 {s.inTransit} в пути</span>}
                          {s.delivered > 0 && <span className="text-success">✓ {s.delivered} доставлено</span>}
                          {s.overdue > 0 && <span className="text-destructive font-medium">⏰ {s.overdue} просрочено</span>}
                          <span className="text-muted-foreground">📈 {s.progress}%</span>
                          <span className="ml-auto font-semibold text-foreground font-numeric tabular-nums">
                            {moneyShort(s.amount)}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              оплачено {moneyShort(s.paid)}
                            </span>
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }
                const request = it.request;
                const index = it.index;
                const isChildRow = it.child === true;
                const overdue = Boolean(request.delivery_date && !DELIVERED_ST.includes(request.status) && isBefore(new Date(request.delivery_date), startOfToday()));
                const priorityShadow = request.priority === "Аварийно" ? "inset 2px 0 0 hsl(var(--destructive))" : request.priority === "Приоритетно" ? "inset 2px 0 0 hsl(var(--warning))" : undefined;

                return (
                <React.Fragment key={request.id}>
                  <TableRow
                  className={cn(
                    "cursor-pointer group border-b border-border",
                    activeRequestId === request.id ? "bg-[hsl(var(--row-sel))] hover:bg-[hsl(var(--row-sel))]" : "hover:bg-[hsl(var(--row-hover))]",
                    isChildRow && activeRequestId !== request.id && "bg-primary/[0.03]"
                  )}
                  onClickCapture={(e) => handleDesktopRowClick(request, e)}
                  onDoubleClick={(e) => handleRowDoubleClick(request, e)}
                  style={{ height: 'var(--row-h)' }}
                >
                  <TableCell data-row-action className="relative text-center p-1 border-b align-middle" style={{ boxShadow: priorityShadow }} onClick={(e) => e.stopPropagation()}>
                    <QuickBadgeSelect
                      requestId={request.id}
                      field="priority"
                      value={request.priority || "Планово"}
                      badge={null}
                      open={openMenu?.id === request.id && openMenu.field === "priority"}
                      onOpenChange={(o) => setOpenMenu(o ? { id: request.id, field: "priority" } : null)}
                      trigger={
                        <span
                          role="button"
                          tabIndex={-1}
                          aria-label={`Приоритет: ${request.priority || "Планово"}`}
                          title={`Приоритет: ${request.priority || "Планово"}`}
                          className="absolute inset-y-0 left-0 w-[6px] cursor-pointer hover:bg-primary/20"
                        />
                      }
                    />
                    {visibility.select !== false && (
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedRequestIds.has(request.id)}
                          onCheckedChange={() => toggleRequestSelection(request.id)}
                          className="h-4 w-4"
                        />
                      </div>
                    )}
                  </TableCell>

                  {visibility.request_date && (
                    <TableCell className="p-1 border-b text-[11px] text-muted-foreground font-mono" data-numeric>
                      {format(new Date(request.request_date), "dd.MM.yy")}
                    </TableCell>
                  )}
                  {visibility.description && (
                    <TableCell className="px-2 py-1.5 border-b overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        {(shipmentsSummary?.[request.id]?.total ?? 0) >= 1 && (
                          <Button
                            data-row-action
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(request.id); }}
                            aria-label={expandedRows.has(request.id) ? "Свернуть перевозки" : "Раскрыть перевозки"}
                          >
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedRows.has(request.id) ? '' : '-rotate-90'}`} />
                          </Button>
                        )}
                        {onToggleFavorite && (
                          <button
                            data-row-action
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(request.id); }}
                            className="shrink-0 hover:scale-110 transition-transform"
                            aria-label={favoriteIds?.has(request.id) ? "Убрать из избранного" : "В избранное"}
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${
                                favoriteIds?.has(request.id)
                                  ? "fill-warning text-warning"
                                  : "text-muted-foreground/20 hover:text-warning"
                              }`}
                            />
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <InlineEditCell
                            requestId={request.id}
                            field="description"
                            value={request.description}
                            displayValue={
                              <div className="space-y-1">
                                <RequestQuickPreview
                                  request={request}
                                  getStatusColor={getStatusColor}
                                  getPriorityColor={getPriorityColor}
                                  onEdit={onEditClick}
                                >
                                  <div className="line-clamp-1 hover:text-primary transition-colors font-medium text-foreground leading-tight" title={request.description}>
                                    <HighlightText text={request.description} searchQuery={searchQuery} />
                                  </div>
                                </RequestQuickPreview>
                                {shipmentsSummary?.[request.id] && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <ShipmentsProgressChip
                                      total={shipmentsSummary[request.id].total}
                                      delivered={shipmentsSummary[request.id].delivered}
                                    />
                                    <ShipmentsSummaryChips {...shipmentsSummary[request.id]} />
                                  </div>
                                )}
                              </div>
                            }
                          />
                        </div>
                        <button
                          data-row-action
                          onClick={(e) => { e.stopPropagation(); openQuickView(request); }}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                          aria-label="Быстрый просмотр"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-primary" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                  {visibility.object && (
                    <TableCell className="px-3 py-2 border-b overflow-hidden text-[14px]">
                      <InlineObjectCell
                        requestId={request.id}
                        organizationId={(request as any).organization_id}
                        objectId={(request as any).object_id}
                        displayValue={
                          (request as any).object_name ? (
                            <div className="line-clamp-2 leading-snug text-foreground" title={(request as any).object_name}>
                              <HighlightText text={(request as any).object_name} searchQuery={searchQuery} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        }
                      />

                    </TableCell>
                  )}
                  {visibility.status && (
                    <TableCell data-row-action className="px-3 py-2 border-b overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <QuickBadgeSelect
                        requestId={request.id}
                        field="status"
                        value={request.status}
                        open={openMenu?.id === request.id && openMenu.field === "status"}
                        onOpenChange={(o) => setOpenMenu(o ? { id: request.id, field: "status" } : null)}
                        badge={
                          <span className={cn(
                            "inline-flex min-h-6 cursor-pointer items-center gap-2 rounded-md px-1.5 hover:bg-muted",
                            overdue && "bg-destructive-soft text-destructive hover:bg-destructive-soft"
                          )}>
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", overdue ? "bg-destructive" : statusDotClass(request.status))} />
                            {overdue ? "Просрочено" : request.status}
                          </span>
                        }
                      />
                    </TableCell>
                  )}

                  {visibility.availability && (
                    <TableCell className="px-3 py-2 border-b overflow-hidden text-[14px]">
                      {request.availability_delivery_time ? (
                        <div className="line-clamp-2 text-foreground leading-snug">
                          <HighlightText text={request.availability_delivery_time} searchQuery={searchQuery} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.contractor && (
                    <TableCell className="px-3 py-2 border-b overflow-hidden text-[14px]">
                      <InlineEditCell
                        requestId={request.id}
                        field="contractor"
                        value={request.contractor || ""}
                        displayValue={
                          request.contractor ? (
                            <div className="line-clamp-2 leading-snug text-foreground">
                              <HighlightText text={request.contractor} searchQuery={searchQuery} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.amount && (
                    <TableCell data-align="right" className="px-2 py-1.5 border-b overflow-hidden text-xs font-mono" data-numeric>
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
                            <span className="text-muted-foreground">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.invoice_number && (
                    <TableCell className="px-2 py-1.5 border-b overflow-hidden text-xs font-mono" data-numeric>
                      {request.invoice_number ? (
                        <div className="line-clamp-2 text-foreground leading-snug">
                          <HighlightText text={request.invoice_number} searchQuery={searchQuery} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.payment_prepay && (
                    <TableCell className="px-2 py-1.5 border-b text-foreground text-xs font-mono overflow-hidden" data-numeric>
                      <InlineEditCell
                        requestId={request.id}
                        field="payment_percentage"
                        value={request.payment_percentage ?? 0}
                        displayValue={
                          <span className="text-muted-foreground">{request.payment_percentage ?? 0}%</span>
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.payment_percentage && (
                    <TableCell className="px-2 py-1.5 border-b font-mono font-semibold overflow-hidden" data-numeric>
                      <InlinePaymentStatusCell
                        requestId={request.id}
                        paymentPercent={(request as any).payment_percent ?? 0}
                      />
                    </TableCell>
                  )}
                  {visibility.shipment_date && (
                    <TableCell data-row-action onClick={(e) => e.stopPropagation()} className="px-2 py-1.5 border-b text-foreground text-xs font-mono overflow-hidden" data-numeric>
                      <InlineEditCell
                        editOnClick
                        requestId={request.id}
                        field="shipment_date"
                        value={request.shipment_date || ""}
                        displayValue={
                          <span>{request.shipment_date ? format(new Date(request.shipment_date), "dd.MM.yy") : <span className="text-muted-foreground">—</span>}</span>
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.delivery_date && (
                    <TableCell data-row-action onClick={(e) => e.stopPropagation()} className="px-2 py-1.5 border-b text-foreground text-xs font-mono overflow-hidden" data-numeric>
                      <InlineEditCell
                        editOnClick
                        requestId={request.id}
                        field="delivery_date"
                        value={request.delivery_date || ""}
                        displayValue={
                          <span>{request.delivery_date ? format(new Date(request.delivery_date), "dd.MM.yy") : <span className="text-muted-foreground">—</span>}</span>
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.transport_company && (
                    <TableCell className="px-3 py-2 border-b overflow-hidden text-[14px]">
                      <InlineEditCell
                        requestId={request.id}
                        field="transport_company"
                        value={request.transport_company || ""}
                        displayValue={
                          request.transport_company ? (
                            <div className="line-clamp-2 text-foreground leading-snug">
                              <HighlightText text={request.transport_company} searchQuery={searchQuery} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.waybill_number && (
                    <TableCell className="px-2 py-1.5 border-b overflow-hidden text-xs font-mono" data-numeric>
                      <InlineEditCell
                        requestId={request.id}
                        field="waybill_number"
                        value={request.waybill_number || ""}
                        displayValue={
                          request.waybill_number ? (
                            <div className="line-clamp-2 text-foreground leading-snug">
                              <HighlightText text={request.waybill_number} searchQuery={searchQuery} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.applicant && (
                    <TableCell data-row-action onClick={(e) => e.stopPropagation()} className="px-3 py-2 border-b overflow-hidden text-[14px]">
                      <InlineEditCell
                        editOnClick
                        requestId={request.id}
                        field="applicant"
                        value={request.applicant || ""}
                        displayValue={
                          request.applicant ? (
                            <div className="line-clamp-2 leading-snug text-foreground">
                              <HighlightText text={request.applicant} searchQuery={searchQuery} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {visibility.executor && (
                    <TableCell data-row-action onClick={(e) => e.stopPropagation()} className="px-3 py-2 border-b overflow-hidden text-[14px]">
                      <InlineExecutorCell
                        requestId={request.id}
                        organizationId={request.organization_id}
                        value={request.executor}
                        searchQuery={searchQuery}
                      />
                    </TableCell>
                  )}
                  {visibility.equipment && (
                    <TableCell className="px-3 py-2 border-b overflow-hidden text-[14px]">
                      {(request as any).equipment_plate || (request as any).equipment_display ? (
                        <div className="leading-snug truncate">
                          <div className="font-medium text-foreground">
                            <HighlightText text={(request as any).equipment_plate || ""} searchQuery={searchQuery} />
                          </div>
                          {(request as any).equipment_display && (
                            <div className="text-[13px] text-muted-foreground truncate">
                              <HighlightText text={(request as any).equipment_display} searchQuery={searchQuery} />
                            </div>
                          )}
                        </div>
                      ) : (
                            <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.comments && (
                    <TableCell className="px-3 py-2 border-b overflow-hidden">
                      <InlineEditCell
                        requestId={request.id}
                        field="comments"
                        value={request.comments || ""}
                        displayValue={
                          request.comments ? (
                            <div className="line-clamp-3 text-muted-foreground text-[13px] leading-snug">
                              <HighlightText text={request.comments} searchQuery={searchQuery} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {/* Row Action Menu */}
                  <TableCell data-row-action className="w-10 text-center px-1 py-2 border-b" onClick={(e) => e.stopPropagation()}>
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
                        <DropdownMenuItem onClick={() => openLabelPrint(request)}>
                          <Tag className="h-4 w-4 mr-2" />
                          Печать этикетки
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
                {expandedRows.has(request.id) && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={100} className="p-0 border-b">
                      <RequestShipmentsTree requestId={request.id} />
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
              );
              });
            })()}
          </TableBody>
        </Table>
        {selectedRequestIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-2 py-1.5 text-xs">
            <span className="font-medium">Выбрано {selectedRequestIds.size}</span>
            <Select disabled={bulkSaving} onValueChange={(v) => applyBulk("status", v)}>
              <SelectTrigger className="h-7 w-[190px] text-xs">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent className="z-[120]">
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select disabled={bulkSaving} onValueChange={(v) => applyBulk("priority", v)}>
              <SelectTrigger className="h-7 w-[150px] text-xs">
                <SelectValue placeholder="Приоритет" />
              </SelectTrigger>
              <SelectContent className="z-[120]">
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearSelection}>
              Снять выделение
            </Button>
            {bulkSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        )}
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

      <LabelPrintDialog
        open={!!labelRequest}
        onOpenChange={(open) => {
          if (!open) closeLabelPrint();
        }}
        description={labelRequest?.description || null}
        applicant={labelRequest?.applicant || null}
      />
    </div>
  );
};
