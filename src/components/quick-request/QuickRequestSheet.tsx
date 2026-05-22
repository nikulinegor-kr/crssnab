import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Zap, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { supabase } from "@/integrations/supabase/client";
import { notifyTelegram } from "@/lib/telegram";

type CreatedRequest = { id: string; description: string; request_number: string };

interface QuickRequestSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const buildRequestNumber = () =>
  `REQ-${new Date().getFullYear()}-${Date.now()}${Math.floor(Math.random() * 100)}`;

export const QuickRequestSheet = ({ open, onOpenChange }: QuickRequestSheetProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();

  const [singleTitle, setSingleTitle] = useState("");
  const [bulkTitles, setBulkTitles] = useState<string[]>(["", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdList, setCreatedList] = useState<CreatedRequest[]>([]);
  const singleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCreatedList([]);
      setSingleTitle("");
      setBulkTitles(["", "", "", "", ""]);
      // Autofocus single input shortly after sheet opens
      setTimeout(() => singleInputRef.current?.focus(), 100);
    }
  }, [open]);

  const insertRequests = async (titles: string[]): Promise<CreatedRequest[]> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Не авторизован");
    if (!currentOrgId) throw new Error("Организация не выбрана");

    const today = new Date().toISOString().slice(0, 10);
    const rows = titles.map((t) => ({
      request_number: buildRequestNumber(),
      request_date: today,
      description: t,
      status: "Новая заявка",
      priority: "Планово",
      applicant: "—",
      created_by: user.id,
      organization_id: currentOrgId,
    }));

    const { data, error } = await supabase
      .from("requests")
      .insert(rows)
      .select("id, description, request_number");

    if (error) throw error;
    return data || [];
  };

  const handleSingleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const title = singleTitle.trim();
    if (!title || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const [req] = await insertRequests([title]);
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Заявка создана", {
        description: req.description,
        action: {
          label: "Открыть",
          onClick: () => {
            onOpenChange(false);
            navigate(`/requests/${req.id}`);
          },
        },
      });
      setSingleTitle("");
      setTimeout(() => singleInputRef.current?.focus(), 50);
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async () => {
    const titles = bulkTitles.map((t) => t.trim()).filter(Boolean);
    if (titles.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await insertRequests(titles);
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success(`Создано заявок: ${created.length}`);
      setCreatedList(created);
      setBulkTitles(["", "", "", "", ""]);
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleBulkSubmit();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const nextEl = document.getElementById(`quick-bulk-${index + 1}`);
      if (nextEl) (nextEl as HTMLInputElement).focus();
      else handleBulkSubmit();
    }
  };

  const body = (
    <div className="flex flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Одна</TabsTrigger>
          <TabsTrigger value="bulk">До 5 заявок</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4">
          <form onSubmit={handleSingleSubmit} className="space-y-3">
            <Input
              ref={singleInputRef}
              value={singleTitle}
              onChange={(e) => setSingleTitle(e.target.value)}
              placeholder="Напр. «Фартуки Metso»"
              className="h-12 text-base"
              autoComplete="off"
              enterKeyHint="send"
              disabled={isSubmitting}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full h-12"
              disabled={!singleTitle.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать заявку
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Остальные поля можно заполнить позже. Статус: «Новая заявка».
            </p>
          </form>
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <div className="space-y-2">
            {bulkTitles.map((t, i) => (
              <Input
                key={i}
                id={`quick-bulk-${i}`}
                value={t}
                onChange={(e) => {
                  const next = [...bulkTitles];
                  next[i] = e.target.value;
                  setBulkTitles(next);
                }}
                onKeyDown={(e) => handleBulkKeyDown(e, i)}
                placeholder={`Заявка #${i + 1}`}
                className="h-11 text-base"
                autoComplete="off"
                enterKeyHint={i === 4 ? "send" : "next"}
                disabled={isSubmitting}
              />
            ))}
            <Button
              onClick={handleBulkSubmit}
              size="lg"
              className="w-full h-12 mt-2"
              disabled={isSubmitting || bulkTitles.every((t) => !t.trim())}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Создать все
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Enter — следующая строка, Cmd/Ctrl+Enter — создать все.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {createdList.length > 0 && (
        <div className="border-t pt-3 space-y-2">
          <p className="text-sm font-medium">Созданы:</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {createdList.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/requests/${r.id}`);
                }}
                className="w-full flex items-center justify-between gap-2 p-2 rounded-md border bg-card hover:bg-accent hover:text-accent-foreground transition-colors text-left"
              >
                <span className="text-sm truncate">{r.description}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setCreatedList([])}
          >
            Создать ещё
          </Button>
        </div>
      )}
    </div>
  );

  const header = (
    <div className="flex items-center gap-2">
      <Zap className="h-5 w-5 text-primary" />
      <span>Быстрая заявка</span>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="p-0 flex flex-col max-h-[90dvh] rounded-t-xl"
        >
          <SheetHeader className="px-4 pt-4 pb-2 border-b text-left">
            <SheetTitle>{header}</SheetTitle>
            <SheetDescription>
              Введите название — остальное заполните позже.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle>{header}</SheetTitle>
          <SheetDescription>
            Введите название — остальное заполните позже.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">{body}</div>
      </SheetContent>
    </Sheet>
  );
};
