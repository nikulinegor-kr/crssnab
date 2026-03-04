import { useState, useMemo } from "react";
import { Search, X, RotateCcw, Sparkles, Loader2, Eye, EyeOff, MapPin } from "lucide-react";
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
import { QuickFilters } from "./QuickFilters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Request } from "@/hooks/useRequests";
import { 
  STATUSES, 
  PRIORITIES, 
  RequestFilters 
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
  hideDelivered: boolean;
  setHideDelivered: (value: boolean) => void;
  years: string[];
  uniqueApplicants: string[];
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
  requests: Request[] | undefined;
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
  hideDelivered,
  setHideDelivered,
  years,
  uniqueApplicants,
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
  requests,
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
    objectFilter !== "all" ||
    !hideDelivered ||
    isSmartSearchActive;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* === LEVEL 4: Search === */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по заявкам..."
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
            className="pl-8 sm:pl-10 pr-20 h-9 sm:h-10 text-sm"
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
        <Button
          variant={hasActiveFilters ? "destructive" : "outline"}
          size="sm"
          onClick={() => { resetFilters(); clearSmartSearch(); }}
          disabled={!hasActiveFilters}
          title="Сбросить все фильтры"
          className="shrink-0 h-9 sm:h-10 px-2 sm:px-3 gap-1.5"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Сбросить</span>
        </Button>
      </div>

      {/* Smart search indicator */}
      {isSmartSearchActive && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Умный поиск активен</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto" onClick={clearSmartSearch}>
            <X className="h-3 w-3 mr-1" />
            Сбросить
          </Button>
        </div>
      )}

      {/* === LEVEL 5: Quick Filters === */}
      <QuickFilters
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
      />

      {/* === LEVEL 6: Advanced Filters === */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Saved filters */}
        <SavedFiltersDropdown
          currentFilters={currentFilters}
          onApplyFilter={(filters) => {
            applyFilters({
              searchQuery: filters.searchQuery || "",
              statusFilter: filters.statusFilter || [],
              priorityFilter: filters.priorityFilter || "all",
              yearFilter: filters.yearFilter || "all",
              applicantFilter: filters.applicantFilter || "all",
              hideDelivered: filters.hideDelivered ?? true,
            });
          }}
        />

        {/* Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-between text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 min-w-0">
              <span className="truncate">
                {statusFilter.length === 0 ? "Статус" : `Статус (${statusFilter.length})`}
              </span>
              {statusFilter.length > 0 && (
                <X
                  className="h-3 w-3 sm:h-4 sm:w-4 ml-1 shrink-0"
                  onClick={(e) => { e.stopPropagation(); setStatusFilter([]); }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] sm:w-[250px] p-3 sm:p-4 bg-background z-50" align="start">
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-xs sm:text-sm font-semibold">Выберите статусы</Label>
              <Button variant="outline" size="sm" onClick={selectAllStatuses} className="w-full text-xs sm:text-sm h-8">
                {statusFilter.length === STATUSES.length ? "Снять всё" : "Выбрать всё"}
              </Button>
              <div className="space-y-1.5 sm:space-y-2 max-h-[200px] overflow-y-auto">
                {STATUSES.map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status}`}
                      checked={statusFilter.includes(status)}
                      onCheckedChange={(checked) => {
                        if (checked) setStatusFilter([...statusFilter, status]);
                        else setStatusFilter(statusFilter.filter((s) => s !== status));
                      }}
                      className="h-4 w-4"
                    />
                    <label htmlFor={`status-${status}`} className="text-xs sm:text-sm cursor-pointer">{status}</label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Applicant Filter */}
        <Select value={applicantFilter} onValueChange={setApplicantFilter}>
          <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 min-w-0 w-auto max-w-[160px]">
            <SelectValue placeholder="Контрагент" />
          </SelectTrigger>
          <SelectContent className="z-50 bg-background max-h-[200px]">
            <SelectItem value="all" className="text-xs sm:text-sm">Все</SelectItem>
            {uniqueApplicants.map((applicant) => (
              <SelectItem key={applicant} value={applicant} className="text-xs sm:text-sm">{applicant}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Object Filter (dropdown) */}
        {availableObjects.length > 0 && (
          <Select value={objectFilter} onValueChange={setObjectFilter}>
            <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 min-w-0 w-auto max-w-[180px]">
              <div className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Объект" />
              </div>
            </SelectTrigger>
            <SelectContent className="z-50 bg-background max-h-[200px]">
              <SelectItem value="all" className="text-xs sm:text-sm">Все объекты</SelectItem>
              {availableObjects.map((obj) => (
                <SelectItem key={obj.id} value={obj.id} className="text-xs sm:text-sm">{obj.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Year Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 min-w-0">
              <span className="truncate">{yearFilter === "all" ? "Год" : yearFilter}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] sm:w-[250px] p-3 sm:p-4 bg-background z-50" align="start">
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-xs sm:text-sm font-semibold">Выберите год</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                  <SelectValue placeholder="Год" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  <SelectItem value="all" className="text-xs sm:text-sm">Все годы</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year} className="text-xs sm:text-sm">{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-2 border-t pt-2 sm:pt-3">
                <Label className="text-xs sm:text-sm font-semibold">Добавить год</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="2026"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddYear(); }}
                    className="text-xs sm:text-sm h-8"
                  />
                  <Button onClick={handleAddYear} size="sm" className="h-8 text-xs sm:text-sm px-2 sm:px-3">+</Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Spacer to push right-side items */}
        <div className="flex-1" />

        {/* Hide Delivered */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-muted/30 px-2 sm:px-3 py-1.5 rounded-md min-w-0">
          <Switch
            id="hideDelivered"
            checked={hideDelivered}
            onCheckedChange={setHideDelivered}
            className="scale-75 sm:scale-90 shrink-0"
          />
          <Label 
            htmlFor="hideDelivered" 
            className="cursor-pointer text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 truncate"
          >
            {hideDelivered ? (
              <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />
            ) : (
              <Eye className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className="truncate hidden sm:inline">Скрыть доставл.</span>
            {deliveredCount > 0 && hideDelivered && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-0.5 shrink-0">{deliveredCount}</Badge>
            )}
          </Label>
        </div>
      </div>
    </div>
  );
};
