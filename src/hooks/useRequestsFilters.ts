import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Request } from "@/hooks/useRequests";
import { addDays, startOfToday, isBefore, isAfter } from "date-fns";

export type SpecialDateFilter = 
  | "deliveredLast7Days" 
  | "upcomingNext7Days" 
  | "overdue" 
  | "stale" 
  | "deliveryToday" 
  | "overdueDelivery" 
  | "unpaid" 
  | "paid" 
  | "invoiced"
  | null;

export interface RequestFilters {
  searchQuery: string;
  statusFilter: string[];
  priorityFilter: string;
  yearFilter: string;
  applicantFilter: string;
  hideDelivered: boolean;
  specialDateFilter: SpecialDateFilter;
  objectFilter: string;
}

export const STATUSES = [
  "Новая заявка",
  "На согласовании",
  "КП",
  "Счёт",
  "Счёт в Бухгалтерии",
  "В работе",
  "В пути",
  "Доставлено в ТК",
  "Доставлено",
  "Выполнено",
];

export const PRIORITIES = ["Аварийно", "Планово", "Приоритетно"];

export const DEFAULT_YEARS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];

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
    case "Счёт в Бухгалтерии":
      return "#a78bfa"; // Серо-фиолетовый
    case "Оплачено":
      return "#3b82f6"; // Сине-голубой
    case "Готов к отгрузке":
      return "#f59e0b"; // Оранжевый/янтарный
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
    (request as any).equipment_display,
    (request as any).equipment_plate,
  ];
  
  return searchableFields.some(field => 
    field?.toLowerCase().includes(searchLower)
  );
};

export const useRequestsFilters = (
  requests: Request[] | undefined,
  activeTab: string
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
  const [objectFilter, setObjectFilter] = useState(savedFilters?.objectFilter || "all");
  const [specialDateFilter, setSpecialDateFilter] = useState<SpecialDateFilter>(null);
  const [years, setYears] = useState<string[]>(DEFAULT_YEARS);

  // Save filters to localStorage whenever they change (exclude specialDateFilter as it's temporary)
  useEffect(() => {
    const currentFilters = {
      searchQuery,
      statusFilter,
      priorityFilter,
      yearFilter,
      applicantFilter,
      hideDelivered,
      objectFilter,
    };
    saveFiltersToStorage(currentFilters as RequestFilters);
  }, [searchQuery, statusFilter, priorityFilter, yearFilter, applicantFilter, hideDelivered, objectFilter]);

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
    const today = startOfToday();
    const sevenDaysAgo = addDays(today, -7);
    const sevenDaysFromNow = addDays(today, 7);
    
    return requests?.filter((request) => {
      // Special date filter
      if (specialDateFilter === "deliveredLast7Days") {
        if (request.status !== "Доставлено" || !request.delivery_date) return false;
        const deliveryDate = new Date(request.delivery_date);
        if (!(isAfter(deliveryDate, sevenDaysAgo) && isBefore(deliveryDate, addDays(today, 1)))) return false;
      }
      
      if (specialDateFilter === "upcomingNext7Days") {
        if (request.status === "Доставлено" || !request.delivery_date) return false;
        const deliveryDate = new Date(request.delivery_date);
        if (!(isAfter(deliveryDate, addDays(today, -1)) && isBefore(deliveryDate, addDays(sevenDaysFromNow, 1)))) return false;
      }

      if (specialDateFilter === "overdue") {
        if (request.status === "Доставлено" || request.status === "Выполнено") return false;
        if (!request.delivery_date) return false;
        if (!isBefore(new Date(request.delivery_date), today)) return false;
      }

      if (specialDateFilter === "stale") {
        if (request.status === "Доставлено" || request.status === "Выполнено") return false;
        const lastUpdate = new Date(request.updated_at || request.created_at);
        const { differenceInDays } = await import("date-fns");
        if (differenceInDays(today, lastUpdate) <= 2) return false;
      }

      if (specialDateFilter === "deliveryToday") {
        if (request.status === "Доставлено" || request.status === "Выполнено") return false;
        if (!request.delivery_date) return false;
        const dd = new Date(request.delivery_date);
        if (dd.toDateString() !== today.toDateString()) return false;
      }

      if (specialDateFilter === "overdueDelivery") {
        if (request.status === "Доставлено" || request.status === "Выполнено") return false;
        if (!request.delivery_date || request.status === "В пути") return false;
        if (!isBefore(new Date(request.delivery_date), today)) return false;
      }

      if (specialDateFilter === "unpaid") {
        if (request.status === "Доставлено" || request.status === "Выполнено") return false;
        if (!(request.status === "Счёт" || (request.payment_percentage === 0 && request.amount > 0))) return false;
      }

      if (specialDateFilter === "paid") {
        if (request.status === "Доставлено" || request.status === "Выполнено") return false;
        if (!(request.payment_percentage === 100 || request.status === "Оплачено")) return false;
      }

      if (specialDateFilter === "invoiced") {
        if (request.status !== "Счёт в Бухгалтерии") return false;
      }
      
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
          : specialDateFilter === "deliveredLast7Days" 
            ? true 
            : !hideDelivered || request.status !== "Доставлено";
      const matchesObject =
        objectFilter === "all" || request.object_id === objectFilter;
      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesYear &&
        matchesApplicant &&
        matchesDelivered &&
        matchesObject
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
    specialDateFilter,
    objectFilter,
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
    if (filters.objectFilter !== undefined) setObjectFilter(filters.objectFilter);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter([]);
    setPriorityFilter("all");
    setYearFilter("all");
    setApplicantFilter("all");
    setHideDelivered(true);
    setSpecialDateFilter(null);
    setObjectFilter("all");
  }, []);

  const currentFilters: RequestFilters = {
    searchQuery,
    statusFilter,
    priorityFilter,
    yearFilter,
    applicantFilter,
    hideDelivered,
    specialDateFilter,
    objectFilter,
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
    specialDateFilter,
    setSpecialDateFilter,
    objectFilter,
    setObjectFilter,
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
