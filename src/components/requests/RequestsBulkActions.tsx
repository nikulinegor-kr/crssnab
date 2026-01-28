import { useNavigate } from "react-router-dom";
import { Plus, Send, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { ExcelExportButton } from "@/components/dashboard/ExcelExportButton";
import { LabelExportButton } from "@/components/dashboard/LabelExportButton";
import { Request } from "@/hooks/useRequests";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface RequestsBulkActionsProps {
  requests: Request[] | undefined;
  filteredRequests: Request[] | undefined;
  selectedRequestIds: Set<string>;
  setSelectedRequestIds: (ids: Set<string>) => void;
  canCreate: boolean;
  isSending: boolean;
  setIsSending: (value: boolean) => void;
  onBulkDelete: () => void;
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
}: RequestsBulkActionsProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
          {/* Bulk status change button */}
          <Button
            onClick={handleBulkStatusChange}
            disabled={isSending}
            variant="secondary"
            className="gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
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
            <span className="hidden xs:inline">Удалить</span>
            <span>({selectedRequestIds.size})</span>
          </Button>
        </>
      )}
      
      {canCreate && (
        <CreateRequestDialog>
          <Button className="gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3" size="sm">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Создать</span>
          </Button>
        </CreateRequestDialog>
      )}
    </div>
  );
};
