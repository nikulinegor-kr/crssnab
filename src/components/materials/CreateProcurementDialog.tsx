import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface MaterialItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  procurement_status?: string;
}

interface CreateProcurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MaterialItem[];
  orgId: string;
  objectName?: string;
  sectionName?: string;
}

export function CreateProcurementDialog({
  open, onOpenChange, items, orgId, objectName, sectionName,
}: CreateProcurementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [contractor, setContractor] = useState("");
  const [comment, setComment] = useState("");

  // Filter out items already in procurement
  const availableItems = items.filter(i => !i.procurement_status || i.procurement_status === "none");

  const handleCreate = async () => {
    if (!description.trim() || availableItems.length === 0) return;
    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");

      // Generate request number
      const { count } = await supabase
        .from("requests")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId);
      const requestNumber = `M-${(count || 0) + 1}`;

      // Create request
      const { data: newRequest, error } = await supabase
        .from("requests")
        .insert({
          organization_id: orgId,
          created_by: user.id,
          request_number: requestNumber,
          description: description.trim(),
          contractor: contractor.trim() || null,
          comments: comment.trim() || null,
          status: "Новая заявка",
          priority: "Планово",
          request_date: new Date().toISOString().split("T")[0],
          request_type: "Закупка материалов",
        })
        .select("id")
        .single();

      if (error) throw error;

      // Create request items from materials
      const requestItems = availableItems.map((item, idx) => ({
        request_id: newRequest.id,
        organization_id: orgId,
        name: item.name,
        quantity: item.quantity || 1,
        article: null,
      }));

      await supabase.from("request_items").insert(requestItems);

      // Update material items with procurement link
      for (const item of availableItems) {
        await (supabase.from("material_statement_items" as any)
          .update({
            procurement_request_id: newRequest.id,
            procurement_status: "in_procurement",
          })
          .eq("id", item.id) as any);
      }

      queryClient.invalidateQueries({ queryKey: ["material-items"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Заявка создана", description: `${requestNumber}: ${availableItems.length} материалов` });
      onOpenChange(false);
      setDescription("");
      setContractor("");
      setComment("");
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const defaultDescription = objectName
    ? `Закупка материалов — ${objectName}${sectionName ? ` / ${sectionName}` : ""}`
    : "Закупка материалов";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Создать заявку на закупку
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Материалов для закупки:</span>
            <strong className="text-primary">{availableItems.length}</strong>
            {items.length !== availableItems.length && (
              <span className="text-muted-foreground">
                (пропущено {items.length - availableItems.length} уже в закупке)
              </span>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Название заявки</label>
            <Input
              value={description || defaultDescription}
              onChange={e => setDescription(e.target.value)}
              placeholder="Описание заявки"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Контрагент</label>
            <Input
              value={contractor}
              onChange={e => setContractor(e.target.value)}
              placeholder="Поставщик (необязательно)"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Комментарий</label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Комментарий к заявке (необязательно)"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleCreate} disabled={loading || availableItems.length === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShoppingCart className="h-4 w-4 mr-1" />}
            Создать заявку ({availableItems.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
