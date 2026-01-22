import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRequests, Request } from "@/hooks/useRequests";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useRequestsFilters } from "@/hooks/useRequestsFilters";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AlertCircle, Plus, MessageCircle } from "lucide-react";

const Requests = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();
  const { canCreate } = useUserRole();

  // Tab state
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const { data: requests, isLoading } = useRequests(activeTab === "archived");

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
        // Single delete
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
        // Bulk delete
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

  return (
    <div className="w-full overflow-hidden p-1.5 xs:p-2 sm:p-3 md:p-4 lg:p-6 space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-6">
      {isTelegramConfigured === false && (
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Telegram не настроен. Настройте его для отправки уведомлений о заявках.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings")}
              className="ml-4"
            >
              Настроить
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "active" | "archived")}
        className="space-y-4"
      >
        <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold truncate">Все заявки</h1>
            <p className="text-xs text-muted-foreground">
              {filters.filteredRequests?.length || 0} найдено
              {selectedRequestIds.size > 0 && (
                <span className="ml-1 sm:ml-2 text-primary font-medium">
                  • {selectedRequestIds.size} выбр.
                </span>
              )}
            </p>
          </div>
          <TabsList className="h-8 sm:h-9">
            <TabsTrigger value="active" className="text-xs sm:text-sm px-2 sm:px-3">Активные</TabsTrigger>
            <TabsTrigger value="archived" className="text-xs sm:text-sm px-2 sm:px-3">Архив</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="space-y-4 mt-0">
          <RequestsBulkActions
            requests={requests}
            filteredRequests={filters.filteredRequests}
            selectedRequestIds={selectedRequestIds}
            setSelectedRequestIds={setSelectedRequestIds}
            canCreate={canCreate}
            isSending={isSending}
            setIsSending={setIsSending}
            onBulkDelete={handleBulkDelete}
          />

          <Card className="p-2 sm:p-3 md:p-4 lg:p-6 overflow-hidden">
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
            />

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
              searchQuery={filters.searchQuery}
            />
          </Card>
        </TabsContent>
      </Tabs>

      {canCreate && (
        <>
          <CreateRequestDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <span className="hidden" />
          </CreateRequestDialog>

          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
            size="icon"
          >
            <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>

          <Button
            onClick={() => navigate("/chat")}
            className="fixed bottom-4 right-[4.5rem] sm:bottom-6 sm:right-24 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
            size="icon"
            variant="secondary"
          >
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </>
      )}

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
