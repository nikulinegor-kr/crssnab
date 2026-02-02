import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Request } from "@/hooks/useRequests";

export interface RequestFilters {
  searchQuery: string;
  statusFilter: string[];
  priorityFilter: string;
  yearFilter: string;
  applicantFilter: string;
  hideDelivered: boolean;
}

export const STATUSES = [
  "Новая заявка",
  "На согласовании",
  "КП",
  "Счёт",
  "В работе",
  "В пути",
  "Доставлено в ТК",
  "Доставлено",
  "Выполнено",
];

export const PRIORITIES = ["Аварийно", "Планово", "Приоритетно"];

export const DEFAULT_YEARS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"];

const FILTERS_STORAGE_KEY = "requests_filters";

export const getStatusColor = (status: string) => {
  switch (status) {
    case "Новая заявка":
      return "#6b7280"; // Серый (нейтральный)
    case "В работе":
      return "#eab308"; // Жёлтый
    case "На согласовании":
      return "#8b5cf6"; // Фиолетовый
    case "КП":
      return "#a855f7"; // Светло-фиолетовый
    case "Счёт":
    case "Счёт в бухгалтерии":
      return "#9ca3af"; // Серо-фиолетовый/нейтральный
    case "Оплачено":
      return "#3b82f6"; // Сине-голубой
    case "В пути":
      return "#22c55e"; // Зелёный
    case "Доставлено в ТК":
      return "#16a34a"; // Тёмно-зелёный
    case "Доставлено":
      return "#10b981"; // Изумрудный
    case "Выполнено":
      return "#15803d"; // Очень тёмно-зелёный
    default:
      return "#6b7280";
  }
};

export const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "Аварийно":
      return "#ef4444";
    case "Приоритетно":
      return "#f97316";
    case "Планово":
      return "#3b82f6";
    default:
      return "#6b7280";
  }
};

const loadFiltersFromStorage = (): Partial<RequestFilters> | null => {
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load filters from storage:", e);
  }
  return null;
};

const saveFiltersToStorage = (filters: RequestFilters) => {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch (e) {
    console.error("Failed to save filters to storage:", e);
  }
};

// Full-text search across all request fields
const matchesFullTextSearch = (request: Request, query: string): boolean => {
  if (!query.trim()) return true;
  
  const searchLower = query.toLowerCase();
  
  // Search across all text fields
  const searchableFields = [
    request.description,
    request.request_number,
    request.applicant,
    request.executor,
    request.contractor,
    request.invoice_number,
    request.transport_company,
    request.waybill_number,
    request.comments,
    request.status,
    request.priority,
    request.availability_delivery_time,
  ];
  
  return searchableFields.some(field => 
    field?.toLowerCase().includes(searchLower)
  );
};

export const useRequestsFilters = (
  requests: Request[] | undefined,
  activeTab: "active" | "archived"
) => {
  const [searchParams] = useSearchParams();
  
  // Load saved filters from localStorage on init
  const savedFilters = useMemo(() => loadFiltersFromStorage(), []);
  
  const [searchQuery, setSearchQuery] = useState(savedFilters?.searchQuery || "");
  const [statusFilter, setStatusFilter] = useState<string[]>(savedFilters?.statusFilter || []);
  const [priorityFilter, setPriorityFilter] = useState(savedFilters?.priorityFilter || "all");
  const [yearFilter, setYearFilter] = useState(savedFilters?.yearFilter || "all");
  const [applicantFilter, setApplicantFilter] = useState(savedFilters?.applicantFilter || "all");
  const [hideDelivered, setHideDelivered] = useState(savedFilters?.hideDelivered ?? true);
  const [years, setYears] = useState<string[]>(DEFAULT_YEARS);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    const currentFilters: RequestFilters = {
      searchQuery,
      statusFilter,
      priorityFilter,
      yearFilter,
      applicantFilter,
      hideDelivered,
    };
    saveFiltersToStorage(currentFilters);
  }, [searchQuery, statusFilter, priorityFilter, yearFilter, applicantFilter, hideDelivered]);

  // Apply filters from URL params on mount (overrides saved filters if present)
  useEffect(() => {
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const isNew = searchParams.get("new");

    if (status) {
      if (status.startsWith("!")) {
        const excludeStatus = status.substring(1);
        if (excludeStatus === "Доставлено") {
          setHideDelivered(true);
        }
      } else {
        setStatusFilter([status]);
      }
    }
    if (priority) {
      setPriorityFilter(priority);
    }
    if (isNew === "true") {
      setYearFilter(new Date().getFullYear().toString());
    }
  }, [searchParams]);

  const filteredRequests = useMemo(() => {
    return requests?.filter((request) => {
      // Full-text search across all fields
      const matchesSearch = matchesFullTextSearch(request, searchQuery);
      const matchesStatus =
        statusFilter.length === 0 || statusFilter.includes(request.status);
      const matchesPriority =
        priorityFilter === "all" || request.priority === priorityFilter;
      const matchesYear =
        yearFilter === "all" || request.request_date.startsWith(yearFilter);
      const matchesApplicant =
        applicantFilter === "all" || request.applicant === applicantFilter;
      const matchesDelivered =
        activeTab === "archived"
          ? true
          : !hideDelivered || request.status !== "Доставлено";
      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesYear &&
        matchesApplicant &&
        matchesDelivered
      );
    });
  }, [
    requests,
    searchQuery,
    statusFilter,
    priorityFilter,
    yearFilter,
    applicantFilter,
    hideDelivered,
    activeTab,
  ]);

  const uniqueApplicants = useMemo(() => {
    return Array.from(
      new Set(requests?.map((r) => r.applicant).filter(Boolean))
    ).sort() as string[];
  }, [requests]);

  const selectAllStatuses = useCallback(() => {
    if (statusFilter.length === STATUSES.length) {
      setStatusFilter([]);
    } else {
      setStatusFilter([...STATUSES]);
    }
  }, [statusFilter.length]);

  const addYear = useCallback((newYear: string) => {
    const trimmedYear = newYear.trim();
    if (trimmedYear && !years.includes(trimmedYear)) {
      setYears(prev => [...prev, trimmedYear].sort());
      return true;
    }
    return false;
  }, [years]);

  const applyFilters = useCallback((filters: Partial<RequestFilters>) => {
    if (filters.searchQuery !== undefined) setSearchQuery(filters.searchQuery);
    if (filters.statusFilter !== undefined) setStatusFilter(filters.statusFilter);
    if (filters.priorityFilter !== undefined) setPriorityFilter(filters.priorityFilter);
    if (filters.yearFilter !== undefined) setYearFilter(filters.yearFilter);
    if (filters.applicantFilter !== undefined) setApplicantFilter(filters.applicantFilter);
    if (filters.hideDelivered !== undefined) setHideDelivered(filters.hideDelivered);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter([]);
    setPriorityFilter("all");
    setYearFilter("all");
    setApplicantFilter("all");
    setHideDelivered(true);
  }, []);

  const currentFilters: RequestFilters = {
    searchQuery,
    statusFilter,
    priorityFilter,
    yearFilter,
    applicantFilter,
    hideDelivered,
  };

  return {
    // State
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
    
    // Computed
    filteredRequests,
    uniqueApplicants,
    currentFilters,
    
    // Actions
    selectAllStatuses,
    addYear,
    applyFilters,
    clearFilters,
  };
};
