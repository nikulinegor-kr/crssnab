import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useRequests, Request } from "@/hooks/useRequests";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useRequestsFilters } from "@/hooks/useRequestsFilters";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateProcurement } from "@/hooks/useProcurements";
import { useRequestFavorites } from "@/hooks/useRequestFavorites";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import { RequestsFilters } from "@/components/requests/RequestsFilters";
import { RequestsBulkActions } from "@/components/requests/RequestsBulkActions";
import { RequestsTable } from "@/components/requests/RequestsTable";
import { RequestsMiniDashboard } from "@/components/requests/RequestsMiniDashboard";
import { ProcurementList } from "@/components/procurement/ProcurementList";

import { AlertCircle, Plus, MessageCircle, ShoppingCart, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const Requests = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();
  const { canCreate } = useUserRole();

  // Tab state
  const [activeTab, setActiveTab] = useState<"active" | "archived" | "procurement" | "favorites">("active");
  const { data: requests, isLoading } = useRequests(activeTab === "archived");
  const createProcurement = useCreateProcurement();
  const { favoriteIds, toggleFavorite } = useRequestFavorites();

  // Filters
  const filters = useRequestsFilters(requests, activeTab);

  // Semantic search results
  const [semanticSearchIds, setSemanticSearchIds] = useState<string[] | null>(null);

  // Selection state
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  // Dialog state
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateInitialData, setDuplicateInitialData] = useState<any>(null);
  const [requestToDelete, setRequestToDelete] = useState<Request | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Telegram config state
  const [isTelegramConfigured, setIsTelegramConfigured] = useState<boolean | null>(null);

  // Check Telegram configuration using secure RPC (no credential exposure)
  useEffect(() => {
    const checkTelegramConfig = async () => {
      if (!currentOrgId) return;
      try {
        const { data, error } = await supabase.rpc('is_telegram_configured', { 
          _org_id: currentOrgId 
        });
        if (error) throw error;
        setIsTelegramConfigured(data === true);
      } catch (error) {
        console.error("Error checking Telegram config:", error);
        setIsTelegramConfigured(false);
      }
    };
    checkTelegramConfig();
  }, [currentOrgId]);

  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequestIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const toggleAllRequests = () => {
    if (selectedRequestIds.size === filters.filteredRequests?.length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(filters.filteredRequests?.map((r) => r.id) || []));
    }
  };

  const handleEditClick = (request: Request) => {
    setSelectedRequest(request);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (request: Request, e: React.MouseEvent) => {
    e.stopPropagation();
    setRequestToDelete(request);
    setShowDeleteDialog(true);
  };

  const handleDuplicateClick = (request: Request) => {
    setDuplicateInitialData({
      description: request.description,
      status: request.status,
      priority: request.priority || undefined,
      applicant: request.applicant || undefined,
      executor: request.executor || undefined,
      object_id: request.object_id || undefined,
      contractor: request.contractor || undefined,
      transport_company: request.transport_company || undefined,
      comments: request.comments || undefined,
      amount: request.amount || undefined,
      invoice_number: request.invoice_number || undefined,
    });
    setDuplicateDialogOpen(true);
  };

  const handleCreateProcurement = async (request: Request) => {
    if (!currentOrgId) return;
    try {
      await createProcurement.mutateAsync([{
        request_id: request.id,
        name: request.description,
        qty: 1,
        price: Number(request.amount) || 0,
      }]);
      toast({
        title: "Поставка создана",
        description: `Создана поставка для заявки "${request.description}"`,
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось создать поставку",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = () => {
    if (selectedRequestIds.size === 0) return;
    setRequestToDelete(null);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!currentOrgId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Пользователь не авторизован");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      const userName = profile?.full_name || profile?.email || "Неизвестный пользователь";

      if (requestToDelete) {
        await supabase.rpc("log_audit_event", {
          _organization_id: currentOrgId,
          _action: "archive",
          _entity_type: "request",
          _entity_id: requestToDelete.id,
          _old_values: {
            request_number: requestToDelete.request_number,
            description: requestToDelete.description,
            status: requestToDelete.status,
            archived_by: userName,
            archive_reason: "Перемещена в архив",
          },
        });

        const { error } = await supabase
          .from("requests")
          .update({ archived: true })
          .eq("id", requestToDelete.id);

        if (error) throw error;

        toast({
          title: "Заявка перемещена в архив",
          description: `Заявка "${requestToDelete.description}" перемещена в архив.`,
        });
      } else {
        for (const requestId of Array.from(selectedRequestIds)) {
          const request = requests?.find((r) => r.id === requestId);
          if (!request) continue;

          await supabase.rpc("log_audit_event", {
            _organization_id: currentOrgId,
            _action: "archive",
            _entity_type: "request",
            _entity_id: requestId,
            _old_values: {
              request_number: request.request_number,
              description: request.description,
              status: request.status,
              archived_by: userName,
              archive_reason: "Перемещена в архив (массовое действие)",
            },
          });

          await supabase
            .from("requests")
            .update({ archived: true })
            .eq("id", requestId);
        }

        toast({
          title: "Заявки перемещены в архив",
          description: `Перемещено заявок: ${selectedRequestIds.size}`,
        });

        setSelectedRequestIds(new Set());
      }

      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setShowDeleteDialog(false);
      setRequestToDelete(null);
    } catch (error) {
      console.error("Error archiving request:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось переместить заявку в архив",
        variant: "destructive",
      });
    }
  };

  const favoriteRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter(r => favoriteIds.has(r.id));
  }, [requests, favoriteIds]);

  const mainTabs = [
    { value: "active", label: "Активные" },
    { value: "favorites", label: "Избранные", icon: <Star className="h-3.5 w-3.5" />, count: favoriteRequests.length },
    { value: "archived", label: "Архив" },
  ] as const;

  const analyticsTabs = [
    { value: "procurement", label: "Стоимость закупок", icon: <ShoppingCart className="h-3.5 w-3.5" /> },
  ] as const;

  const tabs = [...mainTabs, ...analyticsTabs] as const;

  return (
    <div className="w-full overflow-hidden p-1.5 xs:p-2 sm:p-3 md:p-4 lg:p-6 space-y-3 sm:space-y-4">
      {isTelegramConfigured === false && (
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Telegram не настроен. Настройте его для отправки уведомлений о заявках.
            </span>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")} className="ml-4">
              Настроить
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* === LEVEL 1: Page Header === */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">Все заявки</h1>
          <p className="text-xs text-muted-foreground">
            {filters.filteredRequests?.length || 0} найдено
            {(requests?.length || 0) > 0 && (filters.filteredRequests?.length || 0) === 0 && (
              <button
                onClick={filters.clearFilters}
                className="ml-2 text-primary underline hover:no-underline"
              >
                Сбросить фильтры ({requests?.length} всего)
              </button>
            )}
            {selectedRequestIds.size > 0 && (
              <span className="ml-2 text-primary font-medium">
                • {selectedRequestIds.size} выбр.
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canCreate && activeTab === "active" && (
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              size="lg"
              className="gap-2 px-6 text-sm font-semibold shadow-md hover:shadow-lg hover:scale-[1.02] transition-all sticky top-16 z-10"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden xs:inline">Новая заявка</span>
              <span className="xs:hidden" aria-hidden="true">Новая</span>
            </Button>
          )}
        </div>
      </div>

      {/* === LEVEL 2: Tab Navigation === */}
      <nav className="flex gap-1 border-b border-border items-end">
        {mainTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "relative px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors flex items-center gap-1.5",
              "hover:text-foreground",
              activeTab === tab.value
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {"icon" in tab && tab.icon}
            {tab.label}
            {"count" in tab && (tab as any).count > 0 && (
              <span className="ml-1 bg-primary/10 text-primary text-xs rounded-full px-1.5 py-0.5 font-semibold">
                {(tab as any).count}
              </span>
            )}
            {activeTab === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
        <div className="mx-2 h-5 w-px bg-border self-center" />
        {analyticsTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "relative px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors flex items-center gap-1.5",
              "hover:text-foreground",
              activeTab === tab.value
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </nav>

      {/* === Tab Content === */}
      {activeTab === "active" && (
        <div className="space-y-3">
          {/* LEVEL 3: KPI Dashboard */}
          <RequestsMiniDashboard
            requests={requests}
            onFilterClick={(type, value) => {
              filters.setSpecialDateFilter(null);
              if (type === "priority") {
                filters.setPriorityFilter(filters.priorityFilter === value ? "all" : value);
              } else {
                filters.setStatusFilter(filters.statusFilter.length === 1 && filters.statusFilter[0] === value ? [] : [value]);
              }
            }}
            onSpecialFilterClick={(filter) => {
              if (filter) {
                filters.setPriorityFilter("all");
                filters.setStatusFilter([]);
              }
              filters.setSpecialDateFilter(filter);
            }}
            activeSpecialFilter={filters.specialDateFilter}
            activePriorityFilter={filters.priorityFilter}
            activeStatusFilter={filters.statusFilter}
          />

          {/* LEVEL 4-6: Filters (search, quick, advanced) */}
          <RequestsFilters
            searchQuery={filters.searchQuery}
            setSearchQuery={filters.setSearchQuery}
            statusFilter={filters.statusFilter}
            setStatusFilter={filters.setStatusFilter}
            priorityFilter={filters.priorityFilter}
            setPriorityFilter={filters.setPriorityFilter}
            yearFilter={filters.yearFilter}
            setYearFilter={filters.setYearFilter}
            applicantFilter={filters.applicantFilter}
            setApplicantFilter={filters.setApplicantFilter}
            hideDelivered={filters.hideDelivered}
            setHideDelivered={filters.setHideDelivered}
            years={filters.years}
            uniqueApplicants={filters.uniqueApplicants}
            currentFilters={filters.currentFilters}
            selectAllStatuses={filters.selectAllStatuses}
            addYear={filters.addYear}
            applyFilters={filters.applyFilters}
            resetFilters={filters.clearFilters}
            onSemanticSearch={setSemanticSearchIds}
            organizationId={currentOrgId}
            deliveredCount={requests?.filter(r => r.status === "Доставлено").length || 0}
            objectFilter={filters.objectFilter}
            setObjectFilter={filters.setObjectFilter}
            requests={requests}
          />

          {/* Bulk Actions Toolbar */}
          <RequestsBulkActions
            requests={requests}
            filteredRequests={filters.filteredRequests}
            selectedRequestIds={selectedRequestIds}
            setSelectedRequestIds={setSelectedRequestIds}
            canCreate={canCreate}
            isSending={isSending}
            setIsSending={setIsSending}
            onBulkDelete={handleBulkDelete}
            isArchiveTab={false}
          />

          {/* LEVEL 7: Table */}
          <Card className="p-2 sm:p-3 md:p-4 overflow-hidden">
            <RequestsTable
              requests={semanticSearchIds 
                ? filters.filteredRequests?.filter(r => semanticSearchIds.includes(r.id)) 
                : filters.filteredRequests
              }
              isLoading={isLoading}
              selectedRequestIds={selectedRequestIds}
              toggleRequestSelection={toggleRequestSelection}
              toggleAllRequests={toggleAllRequests}
              onDeleteClick={handleDeleteClick}
              onEditClick={handleEditClick}
              onDuplicateClick={handleDuplicateClick}
              onCreateProcurement={handleCreateProcurement}
              searchQuery={filters.searchQuery}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
            />
          </Card>
        </div>
      )}

      {activeTab === "archived" && (
        <div className="space-y-3 sm:space-y-4">
          <RequestsFilters
            searchQuery={filters.searchQuery}
            setSearchQuery={filters.setSearchQuery}
            statusFilter={filters.statusFilter}
            setStatusFilter={filters.setStatusFilter}
            priorityFilter={filters.priorityFilter}
            setPriorityFilter={filters.setPriorityFilter}
            yearFilter={filters.yearFilter}
            setYearFilter={filters.setYearFilter}
            applicantFilter={filters.applicantFilter}
            setApplicantFilter={filters.setApplicantFilter}
            hideDelivered={filters.hideDelivered}
            setHideDelivered={filters.setHideDelivered}
            years={filters.years}
            uniqueApplicants={filters.uniqueApplicants}
            currentFilters={filters.currentFilters}
            selectAllStatuses={filters.selectAllStatuses}
            addYear={filters.addYear}
            applyFilters={filters.applyFilters}
            resetFilters={filters.clearFilters}
            onSemanticSearch={setSemanticSearchIds}
            organizationId={currentOrgId}
            deliveredCount={requests?.filter(r => r.status === "Доставлено").length || 0}
            objectFilter={filters.objectFilter}
            setObjectFilter={filters.setObjectFilter}
            requests={requests}
          />

          <RequestsBulkActions
            requests={requests}
            filteredRequests={filters.filteredRequests}
            selectedRequestIds={selectedRequestIds}
            setSelectedRequestIds={setSelectedRequestIds}
            canCreate={canCreate}
            isSending={isSending}
            setIsSending={setIsSending}
            onBulkDelete={handleBulkDelete}
            isArchiveTab={true}
          />

          <Card className="p-2 sm:p-3 md:p-4 lg:p-6 overflow-hidden">
            <RequestsTable
              requests={semanticSearchIds 
                ? filters.filteredRequests?.filter(r => semanticSearchIds.includes(r.id)) 
                : filters.filteredRequests
              }
              isLoading={isLoading}
              selectedRequestIds={selectedRequestIds}
              toggleRequestSelection={toggleRequestSelection}
              toggleAllRequests={toggleAllRequests}
              onDeleteClick={handleDeleteClick}
              onEditClick={handleEditClick}
              onDuplicateClick={handleDuplicateClick}
              onCreateProcurement={handleCreateProcurement}
              searchQuery={filters.searchQuery}
            />
          </Card>
        </div>
      )}

      {activeTab === "favorites" && (
        <div className="space-y-3 sm:space-y-4">
          {favoriteRequests.length === 0 ? (
            <Card className="p-8 text-center">
              <Star className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">Нет избранных заявок</p>
              <p className="text-xs text-muted-foreground mt-1">
                Нажмите ⭐ в таблице заявок, чтобы добавить в избранное
              </p>
            </Card>
          ) : (
            <Card className="p-2 sm:p-3 md:p-4 lg:p-6 overflow-hidden">
              <RequestsTable
                requests={favoriteRequests}
                isLoading={isLoading}
                selectedRequestIds={selectedRequestIds}
                toggleRequestSelection={toggleRequestSelection}
                toggleAllRequests={toggleAllRequests}
              onDeleteClick={handleDeleteClick}
              onEditClick={handleEditClick}
              onDuplicateClick={handleDuplicateClick}
              onCreateProcurement={handleCreateProcurement}
              searchQuery=""
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
            />
            </Card>
          )}
        </div>
      )}

      {activeTab === "procurement" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={() => setActiveTab("active")} className="gap-1.5">
              ← Назад к заявкам
            </Button>
          </div>
          <ProcurementList />
        </div>
      )}

      {canCreate && (
        <CreateRequestDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <span className="hidden" />
        </CreateRequestDialog>
      )}

      {duplicateInitialData && (
        <CreateRequestDialog
          open={duplicateDialogOpen}
          onOpenChange={(open) => {
            setDuplicateDialogOpen(open);
            if (!open) setDuplicateInitialData(null);
          }}
          initialData={duplicateInitialData}
        >
          <span className="hidden" />
        </CreateRequestDialog>
      )}

      <Button
        onClick={() => navigate("/chat")}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
        size="icon"
        variant="secondary"
        aria-label="Открыть чат"
      >
        <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>

      {selectedRequest && (
        <EditRequestDialog
          request={selectedRequest}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Переместить в архив</AlertDialogTitle>
            <AlertDialogDescription>
              {requestToDelete
                ? `Вы действительно хотите переместить заявку "${requestToDelete.description}" в архив?`
                : `Вы действительно хотите переместить ${selectedRequestIds.size} заявок в архив?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              В архив
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Requests;
