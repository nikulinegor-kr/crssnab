import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

interface BulkTransferObjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRequestIds: Set<string>;
  onComplete: () => void;
}

export const BulkTransferObjectDialog = ({
  open,
  onOpenChange,
  selectedRequestIds,
  onComplete,
}: BulkTransferObjectDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();
  const [targetObjectId, setTargetObjectId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);

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
    enabled: !!currentOrgId && open,
  });

  const handleTransfer = async () => {
    if (!targetObjectId || selectedRequestIds.size === 0) return;
    setIsTransferring(true);
    try {
      // Find warehouse for the target object
      const { data: targetWarehouse } = await supabase
        .from("warehouses")
        .select("id")
        .eq("object_id", targetObjectId)
        .limit(1)
        .maybeSingle();

      const updatePayload: Record<string, unknown> = { object_id: targetObjectId };
      if (targetWarehouse) {
        updatePayload.warehouse_id = targetWarehouse.id;
      }

      const { error } = await supabase
        .from("requests")
        .update(updatePayload)
        .in("id", Array.from(selectedRequestIds));

      if (error) throw error;

      toast({
        title: "Заявки перенесены",
        description: `Перенесено заявок: ${selectedRequestIds.size}${targetWarehouse ? " (склад обновлён)" : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      onComplete();
      onOpenChange(false);
      setTargetObjectId("");
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Перенести заявки
          </DialogTitle>
          <DialogDescription>
            Выбрано заявок: <span className="font-semibold text-foreground">{selectedRequestIds.size}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="text-sm font-medium mb-2 block">Новый объект</label>
          <Select value={targetObjectId} onValueChange={setTargetObjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите объект" />
            </SelectTrigger>
            <SelectContent>
              {objects?.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isTransferring}>
            Отмена
          </Button>
          <Button onClick={handleTransfer} disabled={!targetObjectId || isTransferring}>
            {isTransferring ? "Перенос..." : "Перенести"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
