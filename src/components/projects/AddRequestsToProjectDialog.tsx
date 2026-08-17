import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAttachRequestsToProject } from "@/hooks/useProjects";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projectName: string;
}

export function AddRequestsToProjectDialog({ open, onOpenChange, projectId, projectName }: Props) {
  const { toast } = useToast();
  const attach = useAttachRequestsToProject();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["project-candidates", projectId, open],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_number, description, status, contractor, amount, parent_request_id")
        .eq("is_project", false)
        .eq("archived", false)
        .is("parent_request_id", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return candidates;
    return candidates.filter((r: any) => {
      const hay = [r.description, r.contractor, r.request_number, r.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [candidates, search]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const submit = async () => {
    if (!selected.size) return;
    try {
      await attach.mutateAsync({ projectId, requestIds: Array.from(selected) });
      toast({ title: `Добавлено заявок: ${selected.size}`, description: projectName });
      setSelected(new Set());
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Добавить заявки в проект</DialogTitle>
          <DialogDescription>{projectName}</DialogDescription>
        </DialogHeader>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по описанию, поставщику, статусу…"
        />
        <ScrollArea className="h-[50vh] rounded-md border">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Свободных заявок не найдено</div>
          ) : (
            <ul className="divide-y">
              {filtered.map((r: any) => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 p-2.5 hover:bg-muted/40 cursor-pointer"
                  onClick={() => toggle(r.id)}
                >
                  <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {r.description || r.request_number}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.contractor || "—"}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={!selected.size || attach.isPending}>
            Добавить ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
