import { useState, useMemo } from "react";
import { Search, X, RotateCcw, Sparkles, Loader2, Eye, EyeOff, MapPin, Filter, Truck } from "lucide-react";
import { formatPersonName } from "@/lib/personName";
import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SavedFiltersDropdown } from "@/components/SavedFiltersDropdown";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Request } from "@/hooks/useRequests";
import { 
  STATUSES, 
  RequestFilters,
  SpecialDateFilter,
} from "@/hooks/useRequestsFilters";

interface RequestsFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: string[];
  setStatusFilter: (value: string[]) => void;
  priorityFilter: string;
  setPriorityFilter: (value: string) => void;
  yearFilter: string;
  setYearFilter: (value: string) => void;
  applicantFilter: string;
  setApplicantFilter: (value: string) => void;
  executorFilter: string;
  setExecutorFilter: (value: string) => void;
  hideDelivered: boolean;
  setHideDelivered: (value: boolean) => void;
  years: string[];
  uniqueApplicants: string[];
  uniqueExecutors: string[];
  currentFilters: RequestFilters;
  selectAllStatuses: () => void;
  addYear: (year: string) => boolean;
  applyFilters: (filters: Partial<RequestFilters>) => void;
  resetFilters: () => void;
  onSemanticSearch?: (resultIds: string[] | null) => void;
  organizationId?: string | null;
  deliveredCount?: number;
  objectFilter: string;
  setObjectFilter: (value: string) => void;
  transportCompanyFilter: string;
  setTransportCompanyFilter: (value: string) => void;
  uniqueTransportCompanies: string[];
  requests: Request[] | undefined;
  specialDateFilter?: SpecialDateFilter;
  setSpecialDateFilter?: (value: SpecialDateFilter) => void;
}

export const RequestsFilters = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  yearFilter,
  setYearFilter,
  applicantFilter,
  setApplicantFilter,
  executorFilter,
  setExecutorFilter,
  hideDelivered,
  setHideDelivered,
  years,
  uniqueApplicants,
  uniqueExecutors,
  currentFilters,
  selectAllStatuses,
  addYear,
  applyFilters,
  resetFilters,
  onSemanticSearch,
  organizationId,
  deliveredCount = 0,
  objectFilter,
  setObjectFilter,
  transportCompanyFilter,
  setTransportCompanyFilter,
  uniqueTransportCompanies,
  requests,
  specialDateFilter,
  setSpecialDateFilter,
}: RequestsFiltersProps) => {
  const { toast } = useToast();
  const [newYear, setNewYear] = useState("");
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [isSmartSearchActive, setIsSmartSearchActive] = useState(false);

  // Fetch request objects for dropdown
  const { data: requestObjects } = useQuery({
    queryKey: ["request_objects", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Filter to objects that have requests
  const objectIdsWithRequests = useMemo(() => {
    if (!requests) return new Set<string>();
    return new Set(requests.map(r => r.object_id).filter(Boolean) as string[]);
  }, [requests]);

  const availableObjects = useMemo(() => {
    if (!requestObjects) return [];
    return requestObjects.filter(obj => objectIdsWithRequests.has(obj.id));
  }, [requestObjects, objectIdsWithRequests]);

  const handleAddYear = () => {
    const trimmedYear = newYear.trim();
    if (!trimmedYear) return;
    const success = addYear(trimmedYear);
    if (success) {
      setNewYear("");
      toast({ title: "Год добавлен", description: `Год ${trimmedYear} добавлен в список` });
    } else {
      toast({ title: "Год уже существует", description: `Год ${trimmedYear} уже есть в списке`, variant: "destructive" });
    }
  };

  const handleSmartSearch = async () => {
    if (!searchQuery.trim() || !organizationId || !onSemanticSearch) return;
    setIsSmartSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("semantic-search", {
        body: { query: searchQuery, organizationId },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Ошибка AI", description: data.error, variant: "destructive" });
        return;
      }
      onSemanticSearch(data.results || []);
      setIsSmartSearchActive(true);
      toast({ title: "Умный поиск", description: `Найдено ${data.results?.length || 0} релевантных заявок` });
    } catch (error) {
      console.error("Semantic search error:", error);
      toast({ title: "Ошибка", description: "Не удалось выполнить умный поиск", variant: "destructive" });
    } finally {
      setIsSmartSearching(false);
    }
  };

  const clearSmartSearch = () => {
    setIsSmartSearchActive(false);
    if (onSemanticSearch) onSemanticSearch(null);
  };

  const hasActiveFilters = 
    searchQuery !== "" ||
    statusFilter.length > 0 ||
    priorityFilter !== "all" ||
    yearFilter !== "all" ||
    applicantFilter !== "all" ||
    executorFilter !== "all" ||
    objectFilter !== "all" ||
    transportCompanyFilter !== "all" ||
    hideDelivered ||
    specialDateFilter !== null && specialDateFilter !== undefined ||
    isSmartSearchActive;

  const activeFilterCount = [
    searchQuery !== "",
    statusFilter.length > 0,
    yearFilter !== "all",
    objectFilter !== "all",
    applicantFilter !== "all",
    executorFilter !== "all",
    transportCompanyFilter !== "all",
    priorityFilter !== "all",
    hideDelivered,
    specialDateFilter !== null && specialDateFilter !== undefined,
  ].filter(Boolean).length;

  const objectLabel = availableObjects.find((object) => object.id === objectFilter)?.name;
  const chips = [
    ...(searchQuery ? [{ key: "search", label: `Поиск: ${searchQuery}`, clear: () => setSearchQuery("") }] : []),
    ...statusFilter.map((status) => ({ key: `status-${status}`, label: `Статус: ${status}`, clear: () => setStatusFilter(statusFilter.filter((item) => item !== status)) })),
    ...(priorityFilter !== "all" ? [{ key: "priority", label: `Приоритет: ${priorityFilter}`, clear: () => setPriorityFilter("all") }] : []),
    ...(yearFilter !== "all" ? [{ key: "year", label: `Год: ${yearFilter}`, clear: () => setYearFilter("all") }] : []),
    ...(applicantFilter !== "all" ? [{ key: "applicant", label: `Заявитель: ${formatPersonName(applicantFilter)}`, clear: () => setApplicantFilter("all") }] : []),
    ...(executorFilter !== "all" ? [{ key: "executor", label: `Кто ведёт: ${formatPersonName(executorFilter)}`, clear: () => setExecutorFilter("all") }] : []),
    ...(objectFilter !== "all" ? [{ key: "object", label: `Объект: ${objectLabel || objectFilter}`, clear: () => setObjectFilter("all") }] : []),
    ...(transportCompanyFilter !== "all" ? [{ key: "transport", label: `ТК: ${transportCompanyFilter}`, clear: () => setTransportCompanyFilter("all") }] : []),
    ...(hideDelivered ? [{ key: "delivered", label: "Скрыть доставленные", clear: () => setHideDelivered(false) }] : []),
    ...(specialDateFilter ? [{
      key: "special",
      label: ({ overdue: "Просрочено", stale: "Зависло дольше 2 дней", unpaid: "Ждёт оплаты" } as Partial<Record<Exclude<SpecialDateFilter, null>, string>>)[specialDateFilter] || "Специальный фильтр",
      clear: () => setSpecialDateFilter?.(null),
    }] : []),
  ];

  return (
    <div className="flex flex-col gap-1.5 border border-border bg-card p-2">
      {/* === Search + Filter button row === */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск заявок, артикулов, поставщиков..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (isSmartSearchActive) clearSmartSearch();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim() && organizationId && onSemanticSearch) {
                handleSmartSearch();
              }
            }}
            className="pl-9 pr-20 h-8 text-xs rounded-sm bg-background"
          />
          <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 sm:h-7 sm:w-7 p-0"
                onClick={() => { setSearchQuery(""); clearSmartSearch(); }}
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            )}
            {searchQuery && organizationId && onSemanticSearch && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isSmartSearchActive ? "default" : "ghost"}
                    size="sm"
                    className="h-6 w-6 sm:h-7 sm:w-7 p-0"
                    onClick={handleSmartSearch}
                    disabled={isSmartSearching}
                  >
                    {isSmartSearching ? (
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Умный поиск (по смыслу)</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Combined Filter popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 h-8 px-3 gap-1.5 rounded-sm text-xs">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">
                Фильтр{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </span>
              {activeFilterCount > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px] sm:hidden bg-primary text-primary-foreground">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] sm:w-[320px] p-4 bg-background z-50" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Фильтры</span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => { resetFilters(); clearSmartSearch(); }}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Сбросить
                  </Button>
                )}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Статус</Label>
                  <Button variant="ghost" size="sm" onClick={selectAllStatuses} className="h-5 text-[10px] px-1.5">
                    {statusFilter.length === STATUSES.length ? "Снять" : "Все"}
                  </Button>
                </div>
                <div className="space-y-1 max-h-[160px] overflow-y-auto">
                  {STATUSES.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`filter-status-${status}`}
                        checked={statusFilter.includes(status)}
                        onCheckedChange={(checked) => {
                          if (checked) setStatusFilter([...statusFilter, status]);
                          else setStatusFilter(statusFilter.filter((s) => s !== status));
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor={`filter-status-${status}`} className="text-xs cursor-pointer">{status}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hide delivered toggle — right after statuses */}
              <div className="flex items-center gap-2 py-1 px-2 bg-muted/30 rounded-md">
                <Switch
                  id="hideDeliveredFilter"
                  checked={hideDelivered}
                  onCheckedChange={setHideDelivered}
                  className="scale-75 shrink-0"
                />
                <Label htmlFor="hideDeliveredFilter" className="cursor-pointer text-xs flex items-center gap-1.5">
                  {hideDelivered ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                  <span>Скрыть доставленные</span>
                  {deliveredCount > 0 && hideDelivered && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">{deliveredCount}</Badge>
                  )}
                </Label>
              </div>

              {/* Object */}
              {availableObjects.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Объект</Label>
                  <Select value={objectFilter} onValueChange={setObjectFilter}>
                    <SelectTrigger className="text-xs h-8">
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <SelectValue placeholder="Объект" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-background max-h-[200px]">
                      <SelectItem value="all" className="text-xs">Все объекты</SelectItem>
                      {availableObjects.map((obj) => (
                        <SelectItem key={obj.id} value={obj.id} className="text-xs">{obj.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Year */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Год</Label>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Год" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background">
                    <SelectItem value="all" className="text-xs">Все годы</SelectItem>
                    {years.map((year) => (
                      <SelectItem key={year} value={year} className="text-xs">{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Заявитель — только справочник заявителей */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Заявитель</Label>
                <Select value={applicantFilter} onValueChange={setApplicantFilter}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Заявитель" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background max-h-[200px]">
                    <SelectItem value="all" className="text-xs">Все</SelectItem>
                    {uniqueApplicants.map((applicant) => (
                      <SelectItem key={applicant} value={applicant} className="text-xs">{formatPersonName(applicant)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Кто ведёт — только справочник исполнителей */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Кто ведёт</Label>
                <Select value={executorFilter} onValueChange={setExecutorFilter}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Кто ведёт" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background max-h-[200px]">
                    <SelectItem value="all" className="text-xs">Все</SelectItem>
                    {uniqueExecutors.map((executor) => (
                      <SelectItem key={executor} value={executor} className="text-xs">{formatPersonName(executor)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transport Company */}
              {uniqueTransportCompanies.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Транспортная компания</Label>
                  <Select value={transportCompanyFilter} onValueChange={setTransportCompanyFilter}>
                    <SelectTrigger className="text-xs h-8">
                      <div className="flex items-center gap-1 truncate">
                        <Truck className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <SelectValue placeholder="ТК" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-background max-h-[200px]">
                      <SelectItem value="all" className="text-xs">Все ТК</SelectItem>
                      {uniqueTransportCompanies.map((tc) => (
                        <SelectItem key={tc} value={tc} className="text-xs">{tc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Saved Filters */}
              <div className="border-t pt-3">
                <SavedFiltersDropdown
                  currentFilters={currentFilters}
                  onApplyFilter={(filters) => {
                    applyFilters({
                      searchQuery: filters.searchQuery || "",
                      statusFilter: filters.statusFilter || [],
                      priorityFilter: filters.priorityFilter || "all",
                      yearFilter: filters.yearFilter || "all",
                      applicantFilter: filters.applicantFilter || "all",
                      executorFilter: filters.executorFilter || "all",
                      hideDelivered: filters.hideDelivered ?? true,
                    });
                  }}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { resetFilters(); clearSmartSearch(); }}
            aria-label="Сбросить все фильтры"
            title="Сбросить все фильтры"
            className="shrink-0 h-8 px-2 sm:px-3 gap-1.5 rounded-sm text-xs"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Сбросить всё</span>
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-1.5" aria-label="Активные фильтры">
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted px-2 text-xs text-foreground">
              {chip.label}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={chip.clear}
                className="no-min-tap -mr-1 h-4 min-h-0 w-4 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                aria-label={`Снять фильтр «${chip.label}»`}
              >
                <X className="h-3 w-3" />
              </Button>
            </span>
          ))}
        </div>
      )}

      {/* Smart search indicator */}
      {isSmartSearchActive && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-md text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Умный поиск активен</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto" onClick={clearSmartSearch}>
            <X className="h-3 w-3 mr-1" />
            Сбросить
          </Button>
        </div>
      )}

    </div>
  );
};
