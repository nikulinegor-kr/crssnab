import { useNavigate } from "react-router-dom";
import { Plus, Send, Trash2, Truck, ArchiveRestore, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { ExcelExportButton } from "@/components/dashboard/ExcelExportButton";
import { LabelExportButton } from "@/components/dashboard/LabelExportButton";
import { Request } from "@/hooks/useRequests";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useCreateProcurement } from "@/hooks/useProcurements";

interface RequestsBulkActionsProps {
  requests: Request[] | undefined;
  filteredRequests: Request[] | undefined;
  selectedRequestIds: Set<string>;
  setSelectedRequestIds: (ids: Set<string>) => void;
  canCreate: boolean;
  isSending: boolean;
  setIsSending: (value: boolean) => void;
  onBulkDelete: () => void;
  isArchiveTab?: boolean;
  onBulkRestore?: () => void;
}

export const RequestsBulkActions = ({
  requests,
  filteredRequests,
  selectedRequestIds,
  setSelectedRequestIds,
  canCreate,
  isSending,
  setIsSending,
  onBulkDelete,
  isArchiveTab = false,
  onBulkRestore,
}: RequestsBulkActionsProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();
  const createProcurement = useCreateProcurement();

  const handleBulkStatusChange = async () => {
    if (selectedRequestIds.size === 0) {
      toast({
        title: "Ошибка",
        description: "Выберите хотя бы одну заявку",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      // Filter only requests with status "В пути"
      const selectedRequests = Array.from(selectedRequestIds)
        .map((id) => requests?.find((r) => r.id === id))
        .filter(Boolean) as Request[];
      
      const eligibleRequests = selectedRequests.filter(r => r.status === "В пути");
      const skippedCount = selectedRequests.length - eligibleRequests.length;
      
      if (eligibleRequests.length === 0) {
        toast({
          title: "Нет подходящих заявок",
          description: `Все выбранные заявки (${skippedCount}) не в статусе "В пути"`,
          variant: "destructive",
        });
        setIsSending(false);
        return;
      }

      // Update status for eligible requests
      const { error } = await supabase
        .from("requests")
        .update({ status: "Доставлено в ТК" })
        .in("id", eligibleRequests.map(r => r.id));

      if (error) throw error;

      // Send Telegram notifications for each updated request
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        let tgSuccess = 0;
        let tgError = 0;
        for (const req of eligibleRequests) {
          try {
            const { data, error: tgErr } = await supabase.functions.invoke('notify-telegram', {
              body: { requestId: req.id, mode: 'send' },
              headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (tgErr || data?.error) {
              tgError++;
              console.error("Telegram error for", req.id, tgErr || data?.error);
            } else {
              tgSuccess++;
            }
          } catch (e) {
            tgError++;
            console.error("Telegram send failed for", req.id, e);
          }
        }
        if (tgSuccess > 0) {
          console.log(`Telegram: sent ${tgSuccess}, errors ${tgError}`);
        }
      }

      // Success notification with counts
      if (skippedCount > 0) {
        toast({
          title: "Статус обновлён",
          description: `Обновлено: ${eligibleRequests.length}, пропущено: ${skippedCount} (не в статусе "В пути")`,
        });
      } else {
        toast({
          title: "Статус обновлён",
          description: `Обновлено заявок: ${eligibleRequests.length}`,
        });
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-stats"] });
      setSelectedRequestIds(new Set());
    } catch (error: any) {
      toast({
        title: "Ошибка обновления",
        description: error.message || "Не удалось обновить статус заявок",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendToTelegram = async () => {
    if (selectedRequestIds.size === 0) {
      toast({
        title: "Ошибка",
        description: "Выберите хотя бы одну заявку для отправки",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Ошибка авторизации",
          description: "Сессия истекла. Пожалуйста, войдите снова.",
          variant: "destructive",
        });
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      let errorMessages: string[] = [];

      for (const requestId of Array.from(selectedRequestIds)) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error("Токен авторизации недоступен");
          }

          const { data, error } = await supabase.functions.invoke('notify-telegram', {
            body: { requestId, mode: 'send' },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });

          if (error) {
            errorMessages.push(error.message || 'Неизвестная ошибка');
            errorCount++;
          } else if (data?.error) {
            errorMessages.push(data.error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err: any) {
          errorMessages.push(err.message || 'Неизвестная ошибка');
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Успешно отправлено",
          description: `Отправлено заявок: ${successCount}${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`,
        });
        setSelectedRequestIds(new Set());
      } else {
        const uniqueErrors = [...new Set(errorMessages)];
        const errorDetail = uniqueErrors.length > 0 ? uniqueErrors[0] : "Проверьте настройки Telegram";
        const isTelegramConfigError = errorDetail.includes("Telegram не настроен");

        toast({
          title: "Ошибка отправки",
          description: errorDetail,
          variant: "destructive",
          action: isTelegramConfigError ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings?tab=integrations")}
            >
              Настроить Telegram
            </Button>
          ) : undefined,
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка отправки",
        description: error.message || "Не удалось отправить заявки в Telegram.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const selectedRequests = Array.from(selectedRequestIds)
    .map((id) => requests?.find((r) => r.id === id)!)
    .filter(Boolean);

  const handleBulkRestore = async () => {
    if (selectedRequestIds.size === 0) {
      toast({
        title: "Ошибка",
        description: "Выберите хотя бы одну заявку",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Пользователь не авторизован");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      const userName = profile?.full_name || profile?.email || "Неизвестный пользователь";

      for (const requestId of Array.from(selectedRequestIds)) {
        const request = requests?.find((r) => r.id === requestId);
        if (!request) continue;

        if (currentOrgId) {
          await supabase.rpc("log_audit_event", {
            _organization_id: currentOrgId,
            _action: "restore",
            _entity_type: "request",
            _entity_id: requestId,
            _new_values: {
              request_number: request.request_number,
              description: request.description,
              status: request.status,
              restored_by: userName,
              restore_reason: "Восстановлена из архива",
            },
          });
        }

        await supabase
          .from("requests")
          .update({ archived: false })
          .eq("id", requestId);
      }

      toast({
        title: "Заявки восстановлены",
        description: `Восстановлено заявок: ${selectedRequestIds.size}`,
      });

      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequestIds(new Set());
    } catch (error: any) {
      toast({
        title: "Ошибка восстановления",
        description: error.message || "Не удалось восстановить заявки",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      {requests && requests.length > 0 && (
        <>
          <ExcelExportButton requests={requests} filteredRequests={filteredRequests} />
          <LabelExportButton selectedRequests={selectedRequests} />
        </>
      )}
      
      {selectedRequestIds.size > 0 && (
        <>
          {isArchiveTab ? (
            /* Restore from archive button */
            <Button
              onClick={handleBulkRestore}
              disabled={isSending}
              className="gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              size="sm"
              title="Восстановить выбранные заявки из архива"
            >
              <ArchiveRestore className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Восстановить</span>
              <span>({selectedRequestIds.size})</span>
            </Button>
          ) : (
            <>
              {/* Create procurement button */}
              <Button
                onClick={async () => {
                  const selectedReqs = Array.from(selectedRequestIds)
                    .map((id) => requests?.find((r) => r.id === id))
                    .filter(Boolean) as Request[];
                  
                  const hasZeroPrice = selectedReqs.some(r => !r.amount || r.amount === 0);
                  
                  const items = selectedReqs.map(r => ({
                    request_id: r.id,
                    name: r.description,
                    qty: 1,
                    price: r.amount || 0,
                  }));

                  try {
                    await createProcurement.mutateAsync(items);
                    toast({
                      title: "Закуп сформирован",
                      description: `Добавлено позиций: ${items.length}${hasZeroPrice ? " (есть позиции без цены!)" : ""}`,
                    });
                    setSelectedRequestIds(new Set());
                  } catch (err: any) {
                    toast({
                      title: "Ошибка",
                      description: err.message || "Не удалось сформировать закуп",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={isSending || createProcurement.isPending}
                variant="secondary"
                className="gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                size="sm"
              >
                <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Сформировать закуп</span>
                <span className="sm:hidden">Закуп</span>
              </Button>
              {/* Bulk status change button */}
              <Button
                onClick={handleBulkStatusChange}
                disabled={isSending}
                className="gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
                title="Изменить статус выбранных заявок со статусом 'В пути' на 'Доставлено в ТК'"
              >
                <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Доставлено в ТК</span>
              </Button>
              <Button
                onClick={handleSendToTelegram}
                disabled={isSending}
                className="gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                size="sm"
              >
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Telegram</span>
              </Button>
              <Button
                onClick={onBulkDelete}
                variant="destructive"
                className="gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                size="sm"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">В архив</span>
                <span>({selectedRequestIds.size})</span>
              </Button>
            </>
          )}
        </>
      )}
      
    </div>
  );
};
