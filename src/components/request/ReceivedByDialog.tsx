import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { PackageCheck } from "lucide-react";

interface ReceivedByDialogProps {
  open: boolean;
  organizationId: string | null | undefined;
  defaultValue?: string | null;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}

export function ReceivedByDialog({ open, organizationId, defaultValue, onCancel, onConfirm }: ReceivedByDialogProps) {
  const [value, setValue] = useState(defaultValue || "");
  const [applicants, setApplicants] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue || "");
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open || !organizationId) return;
    (async () => {
      const { data } = await supabase
        .from("request_participants")
        .select("name")
        .eq("organization_id", organizationId)
        .eq("participant_type", "applicant")
        .eq("is_active", true)
        .order("name");
      setApplicants((data || []).map((d: any) => d.name).filter(Boolean));
    })();
  }, [open, organizationId]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            Приёмку ТМЦ осуществил
          </DialogTitle>
          <DialogDescription>
            Укажите ФИО получателя — выберите из заявителей или введите вручную.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="received-by-input">ФИО получателя</Label>
          <Input
            id="received-by-input"
            list="received-by-applicants"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Введите ФИО или выберите из списка"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
          />
          <datalist id="received-by-applicants">
            {applicants.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {applicants.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Начните вводить или нажмите ▾ для выбора из заявителей
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Отмена</Button>
          <Button onClick={handleConfirm} disabled={!value.trim()}>
            Подтвердить приёмку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
