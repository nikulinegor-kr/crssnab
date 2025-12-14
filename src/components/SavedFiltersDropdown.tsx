import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Filter, Save, Trash2, Star, Check } from "lucide-react";

interface FilterState {
  searchQuery: string;
  statusFilter: string[];
  priorityFilter: string;
  yearFilter: string;
  applicantFilter: string;
  hideDelivered: boolean;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  is_default: boolean;
}

interface SavedFiltersDropdownProps {
  currentFilters: FilterState;
  onApplyFilter: (filters: FilterState) => void;
}

export const SavedFiltersDropdown = ({
  currentFilters,
  onApplyFilter,
}: SavedFiltersDropdownProps) => {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: savedFilters = [] } = useQuery({
    queryKey: ["saved-filters", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("saved_request_filters")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        filters: item.filters as unknown as FilterState,
        is_default: item.is_default ?? false,
      })) as SavedFilter[];
    },
    enabled: !!currentOrgId,
  });

  const saveFilterMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentOrgId) throw new Error("Не авторизован");

      const { error } = await supabase.from("saved_request_filters").insert({
        user_id: user.id,
        organization_id: currentOrgId,
        name,
        filters: currentFilters as unknown as Record<string, unknown>,
      } as never);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
      toast({ title: "Фильтр сохранён" });
      setSaveDialogOpen(false);
      setFilterName("");
    },
    onError: () => {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    },
  });

  const deleteFilterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("saved_request_filters")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
      toast({ title: "Фильтр удалён" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentOrgId) throw new Error("Не авторизован");

      // Remove default from all
      await supabase
        .from("saved_request_filters")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("organization_id", currentOrgId);

      // Set new default
      const { error } = await supabase
        .from("saved_request_filters")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
      toast({ title: "Фильтр по умолчанию обновлён" });
    },
  });

  const handleSave = () => {
    if (filterName.trim()) {
      saveFilterMutation.mutate(filterName.trim());
    }
  };

  const handleApply = (filter: SavedFilter) => {
    onApplyFilter(filter.filters);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Фильтры
            {savedFilters.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs">
                {savedFilters.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Сохранённые фильтры</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {savedFilters.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              Нет сохранённых фильтров
            </div>
          ) : (
            savedFilters.map((filter) => (
              <DropdownMenuItem
                key={filter.id}
                className="flex items-center justify-between gap-2"
                onSelect={(e) => e.preventDefault()}
              >
                <button
                  className="flex-1 text-left truncate"
                  onClick={() => handleApply(filter)}
                >
                  {filter.name}
                </button>
                <div className="flex items-center gap-1">
                  {filter.is_default && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDefaultMutation.mutate(filter.id);
                    }}
                    className="p-1 hover:bg-muted rounded"
                    title="Сделать по умолчанию"
                  >
                    <Star className={`h-3.5 w-3.5 ${filter.is_default ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFilterMutation.mutate(filter.id);
                    }}
                    className="p-1 hover:bg-destructive/10 rounded text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </DropdownMenuItem>
            ))
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSaveDialogOpen(true)}>
            <Save className="mr-2 h-4 w-4" />
            Сохранить текущий фильтр
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сохранить фильтр</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Название фильтра"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={!filterName.trim()}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
