import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Send, Trash2, Truck, ArchiveRestore, ShoppingCart, CheckCircle, Flag, UserPlus, X, ChevronDown, MapPin, ArrowRightLeft, CreditCard } from "lucide-react";
import { BulkTransferObjectDialog } from "./BulkTransferObjectDialog";
import { Button } from "@/components/ui/button";
import { ExcelExportButton } from "@/components/dashboard/ExcelExportButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Request } from "@/hooks/useRequests";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  // Fetch statuses for the org
  const { data: statuses } = useQuery({
    queryKey: ["request-statuses", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("request_statuses")
        .select("id, name, color")
        .eq("organization_id", currentOrgId)
        .order("order");
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  // Fetch priorities for the org
  const { data: priorities } = useQuery({
    queryKey: ["request-priorities", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("request_priorities")
        .select("id, name, color")
        .eq("organization_id", currentOrgId)
        .order("order");
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  // Fetch participants (executors)
  const { data: executors } = useQuery({
    queryKey: ["request-participants-executors", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("request_participants")
        .select("id, name")
        .eq("organization_id", currentOrgId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  // Fetch objects
  const { data: objects } = useQuery({
    queryKey: ["request-objects", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", currentOrgId)
        .eq("archived", false)
        .order("name");
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  const handleBulkObjectUpdate = async (objectId: string) => {
    if (selectedRequestIds.size === 0) return;
    setIsSending(true);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ object_id: objectId })
        .in("id", Array.from(selectedRequestIds));
      if (error) throw error;
      toast({ title: "Объект обновлён", description: `Обновлено заявок: ${selectedRequestIds.size}` });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequestIds(new Set());
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedRequestIds.size === 0) return;
    setIsSending(true);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ status: newStatus })
        .in("id", Array.from(selectedRequestIds));
      if (error) throw error;
      toast({ title: "Статус обновлён", description: `Обновлено заявок: ${selectedRequestIds.size}` });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequestIds(new Set());
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkPriorityUpdate = async (newPriority: string) => {
    if (selectedRequestIds.size === 0) return;
    setIsSending(true);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ priority: newPriority })
        .in("id", Array.from(selectedRequestIds));
      if (error) throw error;
      toast({ title: "Приоритет обновлён", description: `Обновлено заявок: ${selectedRequestIds.size}` });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequestIds(new Set());
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkExecutorUpdate = async (executor: string) => {
    if (selectedRequestIds.size === 0) return;
    setIsSending(true);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ executor })
        .in("id", Array.from(selectedRequestIds));
      if (error) throw error;
      toast({ title: "Исполнитель назначен", description: `Обновлено заявок: ${selectedRequestIds.size}` });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequestIds(new Set());
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkPaymentUpdate = async (percent: number) => {
    if (selectedRequestIds.size === 0) return;
    setIsSending(true);
    try {
      const status = percent === 0 ? "Не оплачено" : percent >= 100 ? "Оплачено" : "Частично оплачено";
      const { error } = await supabase
        .from("requests")
        .update({ payment_percent: percent, payment_status: status })
        .in("id", Array.from(selectedRequestIds));
      if (error) throw error;
      toast({ title: "Оплата обновлена", description: `Обновлено заявок: ${selectedRequestIds.size}` });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequestIds(new Set());
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkStatusChange = async () => {
    if (selectedRequestIds.size === 0) {
      toast({ title: "Ошибка", description: "Выберите хотя бы одну заявку", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
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

      const { error } = await supabase
        .from("requests")
        .update({ status: "Доставлено в ТК" })
        .in("id", eligibleRequests.map(r => r.id));

      if (error) throw error;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        for (const req of eligibleRequests) {
          try {
            await supabase.functions.invoke('notify-telegram', {
              body: { requestId: req.id, mode: 'send' },
              headers: { Authorization: `Bearer ${session.access_token}` }
            });
          } catch (e) {
            console.error("Telegram send failed for", req.id, e);
          }
        }
      }

      if (skippedCount > 0) {
        toast({ title: "Статус обновлён", description: `Обновлено: ${eligibleRequests.length}, пропущено: ${skippedCount}` });
      } else {
        toast({ title: "Статус обновлён", description: `Обновлено заявок: ${eligibleRequests.length}` });
      }

      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-stats"] });
      setSelectedRequestIds(new Set());
    } catch (error: any) {
      toast({ title: "Ошибка обновления", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendToTelegram = async () => {
    if (selectedRequestIds.size === 0) {
      toast({ title: "Ошибка", description: "Выберите хотя бы одну заявку для отправки", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Ошибка авторизации", description: "Сессия истекла.", variant: "destructive" });
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const requestId of Array.from(selectedRequestIds)) {
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          const { data, error } = await supabase.functions.invoke('notify-telegram', {
            body: { requestId, mode: 'send' },
            headers: { Authorization: `Bearer ${s?.access_token}` }
          });
          if (error || data?.error) errorCount++;
          else successCount++;
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({ title: "Успешно отправлено", description: `Отправлено: ${successCount}${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}` });
        setSelectedRequestIds(new Set());
      } else {
        toast({ title: "Ошибка отправки", description: "Проверьте настройки Telegram", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Ошибка отправки", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendToTelegramBuh = async () => {
    if (selectedRequestIds.size === 0) {
      toast({ title: "Ошибка", description: "Выберите хотя бы одну заявку для отправки", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Ошибка авторизации", description: "Сессия истекла.", variant: "destructive" });
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const requestId of Array.from(selectedRequestIds)) {
        try {
          const { data, error } = await supabase.functions.invoke('notify-telegram', {
            body: { requestId, action: 'send_to_invoice_chat' },
          });
          if (error || data?.error) errorCount++;
          else successCount++;
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({ title: "Telegram Buh", description: `Отправлено: ${successCount}${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}` });
        setSelectedRequestIds(new Set());
      } else {
        toast({ title: "Ошибка отправки", description: "Проверьте настройки Telegram Buh", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Ошибка отправки", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedRequestIds.size === 0) return;
    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Пользователь не авторизован");
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
      const userName = profile?.full_name || profile?.email || "Неизвестный";

      for (const requestId of Array.from(selectedRequestIds)) {
        const request = requests?.find((r) => r.id === requestId);
        if (!request || !currentOrgId) continue;
        await supabase.rpc("log_audit_event", {
          _organization_id: currentOrgId,
          _action: "restore",
          _entity_type: "request",
          _entity_id: requestId,
          _new_values: { request_number: request.request_number, restored_by: userName },
        });
        await supabase.from("requests").update({ archived: false }).eq("id", requestId);
      }

      toast({ title: "Заявки восстановлены", description: `Восстановлено: ${selectedRequestIds.size}` });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequestIds(new Set());
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const selectedRequests = Array.from(selectedRequestIds)
    .map((id) => requests?.find((r) => r.id === id)!)
    .filter(Boolean);

  // Export button always visible
  const exportButton = requests && requests.length > 0 && (
    <ExcelExportButton requests={requests} filteredRequests={filteredRequests} />
  );

  // If no selection, just show export
  if (selectedRequestIds.size < 1) {
    return <div className="flex flex-wrap gap-1.5 sm:gap-2">{exportButton}</div>;
  }

  // Toolbar for 2+ selected
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2 flex-wrap">
        <span className="text-sm font-medium text-foreground whitespace-nowrap">
          Выбрано: <span className="text-primary font-bold">{selectedRequestIds.size}</span>
        </span>

        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

        {isArchiveTab ? (
          <Button
            onClick={handleBulkRestore}
            disabled={isSending}
            variant="outline"
            className="gap-1.5 text-xs h-8 px-3"
            size="sm"
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
            Восстановить
          </Button>
        ) : (
          <>
            {/* Change Status Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-3" disabled={isSending}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Изменить статус</span>
                  <span className="sm:hidden">Статус</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                {statuses && statuses.length > 0 ? (
                  statuses.map((s) => (
                    <DropdownMenuItem key={s.id} onClick={() => handleBulkStatusUpdate(s.name)}>
                      <span
                        className="w-2 h-2 rounded-full mr-2 shrink-0"
                        style={{ backgroundColor: s.color || "hsl(var(--primary))" }}
                      />
                      {s.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <>
                    {["Новая заявка", "В работе", "Заказано", "В пути", "Доставлено в ТК", "Доставлено"].map((s) => (
                      <DropdownMenuItem key={s} onClick={() => handleBulkStatusUpdate(s)}>{s}</DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Change Priority Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-3" disabled={isSending}>
                  <Flag className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Изменить приоритет</span>
                  <span className="sm:hidden">Приоритет</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {priorities && priorities.length > 0 ? (
                  priorities.map((p) => (
                    <DropdownMenuItem key={p.id} onClick={() => handleBulkPriorityUpdate(p.name)}>
                      <span
                        className="w-2 h-2 rounded-full mr-2 shrink-0"
                        style={{ backgroundColor: p.color || "hsl(var(--primary))" }}
                      />
                      {p.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <>
                    {["Планово", "Срочно", "Аварийно"].map((p) => (
                      <DropdownMenuItem key={p} onClick={() => handleBulkPriorityUpdate(p)}>{p}</DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Assign Executor Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-3" disabled={isSending}>
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Назначить исполнителя</span>
                  <span className="sm:hidden">Исполнитель</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                {executors && executors.length > 0 ? (
                  executors.map((e) => (
                    <DropdownMenuItem key={e.id} onClick={() => handleBulkExecutorUpdate(e.name)}>
                      {e.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>Нет участников</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Transfer to Object */}
            <Button
              onClick={() => setTransferDialogOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8 px-3"
              disabled={isSending}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Перенести в объект</span>
              <span className="sm:hidden">Перенести</span>
            </Button>

            {/* Change Object Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-3" disabled={isSending}>
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Изменить объект</span>
                  <span className="sm:hidden">Объект</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                {objects && objects.length > 0 ? (
                  objects.map((o) => (
                    <DropdownMenuItem key={o.id} onClick={() => handleBulkObjectUpdate(o.id)}>
                      {o.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>Нет объектов</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Selected */}
            <ExcelExportButton
              requests={requests || []}
              filteredRequests={selectedRequests}
            />

            <div className="h-4 w-px bg-border mx-0.5 hidden sm:block" />

            {/* Existing actions */}
            <Button
              onClick={async () => {
                const selectedReqs = selectedRequests as Request[];
                const items = selectedReqs.map(r => ({
                  request_id: r.id,
                  name: r.description,
                  qty: 1,
                  price: r.amount || 0,
                }));
                try {
                  await createProcurement.mutateAsync(items);
                  toast({ title: "Закуп сформирован", description: `Позиций: ${items.length}` });
                  setSelectedRequestIds(new Set());
                } catch (err: any) {
                  toast({ title: "Ошибка", description: err.message, variant: "destructive" });
                }
              }}
              disabled={isSending || createProcurement.isPending}
              variant="outline"
              className="gap-1.5 text-xs h-8 px-3"
              size="sm"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Стоимость закупок</span>
            </Button>

            <Button
              onClick={handleBulkStatusChange}
              disabled={isSending}
              className="gap-1.5 text-xs h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              size="sm"
            >
              <Truck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Доставлено в ТК</span>
            </Button>

            <Button
              onClick={handleSendToTelegram}
              disabled={isSending}
              variant="outline"
              className="gap-1.5 text-xs h-8 px-3"
              size="sm"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Telegram</span>
            </Button>

            <Button
              onClick={handleSendToTelegramBuh}
              disabled={isSending}
              variant="outline"
              className="gap-1.5 text-xs h-8 px-3"
              size="sm"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Telegram Buh</span>
            </Button>

            <Button
              onClick={onBulkDelete}
              variant="destructive"
              className="gap-1.5 text-xs h-8 px-3"
              size="sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">В архив</span>
              <span>({selectedRequestIds.size})</span>
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-auto"
          onClick={() => setSelectedRequestIds(new Set())}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <BulkTransferObjectDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        selectedRequestIds={selectedRequestIds}
        onComplete={() => setSelectedRequestIds(new Set())}
      />
    </div>
  );
};
