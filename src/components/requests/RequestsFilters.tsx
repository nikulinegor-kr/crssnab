import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { SavedFiltersDropdown } from "@/components/SavedFiltersDropdown";
import { useToast } from "@/hooks/use-toast";
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
}: RequestsFiltersProps) => {
  const { toast } = useToast();
  const [newYear, setNewYear] = useState("");

  const handleAddYear = () => {
    const trimmedYear = newYear.trim();
    if (!trimmedYear) return;
    
    const success = addYear(trimmedYear);
    if (success) {
      setNewYear("");
      toast({
        title: "Год добавлен",
        description: `Год ${trimmedYear} добавлен в список`,
      });
    } else {
      toast({
        title: "Год уже существует",
        description: `Год ${trimmedYear} уже есть в списке`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 mb-4 sm:mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {/* Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-between text-sm">
              {statusFilter.length === 0
                ? "Статус"
                : `Статус (${statusFilter.length})`}
              {statusFilter.length > 0 && (
                <X
                  className="h-4 w-4 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatusFilter([]);
                  }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-4 bg-background z-50" align="start">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Выберите статусы</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllStatuses}
                className="w-full"
              >
                {statusFilter.length === STATUSES.length ? "Снять всё" : "Выбрать всё"}
              </Button>
              <div className="space-y-2">
                {STATUSES.map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status}`}
                      checked={statusFilter.includes(status)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setStatusFilter([...statusFilter, status]);
                        } else {
                          setStatusFilter(statusFilter.filter((s) => s !== status));
                        }
                      }}
                    />
                    <label htmlFor={`status-${status}`} className="text-sm cursor-pointer">
                      {status}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Priority Filter */}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Приоритет" />
          </SelectTrigger>
          <SelectContent className="z-50 bg-background">
            <SelectItem value="all">Все приоритеты</SelectItem>
            {PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Applicant Filter */}
        <Select value={applicantFilter} onValueChange={setApplicantFilter}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Заявитель" />
          </SelectTrigger>
          <SelectContent className="z-50 bg-background">
            <SelectItem value="all">Все заявители</SelectItem>
            {uniqueApplicants.map((applicant) => (
              <SelectItem key={applicant} value={applicant}>
                {applicant}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="text-sm">
              {yearFilter === "all" ? "Год" : yearFilter}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-4 bg-background z-50" align="start">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Выберите год</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Год" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  <SelectItem value="all">Все годы</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-2 border-t pt-3">
                <Label className="text-sm font-semibold">Добавить новый год</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="2026"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddYear();
                      }
                    }}
                    className="text-sm"
                  />
                  <Button onClick={handleAddYear} size="sm">
                    Добавить
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Hide Delivered */}
        <div className="flex items-center space-x-2 bg-muted/30 px-3 py-2 rounded-md">
          <Checkbox
            id="hideDelivered"
            checked={hideDelivered}
            onCheckedChange={(checked) => setHideDelivered(checked as boolean)}
          />
          <Label htmlFor="hideDelivered" className="cursor-pointer text-xs sm:text-sm whitespace-nowrap">
            Скрыть доставленные
          </Label>
        </div>
      </div>
    </div>
  );
};
