import { useState, useEffect, useMemo } from "react";
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

export const getStatusColor = (status: string) => {
  switch (status) {
    case "Доставлено":
    case "Доставлено в ТК":
    case "Выполнено":
      return "#10b981";
    case "Новая заявка":
      return "#3b82f6";
    case "На согласовании":
    case "КП":
      return "#a855f7";
    case "Счёт":
      return "#f97316";
    case "В работе":
    case "В пути":
      return "#eab308";
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

export const useRequestsFilters = (
  requests: Request[] | undefined,
  activeTab: "active" | "archived"
) => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [applicantFilter, setApplicantFilter] = useState("all");
  const [hideDelivered, setHideDelivered] = useState(true);
  const [years, setYears] = useState<string[]>(DEFAULT_YEARS);

  // Apply filters from URL params on mount
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
      const matchesSearch = request.description
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
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

  const selectAllStatuses = () => {
    if (statusFilter.length === STATUSES.length) {
      setStatusFilter([]);
    } else {
      setStatusFilter([...STATUSES]);
    }
  };

  const addYear = (newYear: string) => {
    const trimmedYear = newYear.trim();
    if (trimmedYear && !years.includes(trimmedYear)) {
      setYears([...years, trimmedYear].sort());
      return true;
    }
    return false;
  };

  const applyFilters = (filters: Partial<RequestFilters>) => {
    if (filters.searchQuery !== undefined) setSearchQuery(filters.searchQuery);
    if (filters.statusFilter !== undefined) setStatusFilter(filters.statusFilter);
    if (filters.priorityFilter !== undefined) setPriorityFilter(filters.priorityFilter);
    if (filters.yearFilter !== undefined) setYearFilter(filters.yearFilter);
    if (filters.applicantFilter !== undefined) setApplicantFilter(filters.applicantFilter);
    if (filters.hideDelivered !== undefined) setHideDelivered(filters.hideDelivered);
  };

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
  };
};
