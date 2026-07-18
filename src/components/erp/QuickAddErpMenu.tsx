import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Filter, Wrench, Sparkles } from "lucide-react";
import { FilterElementFormDialog } from "@/components/filter-elements/FilterElementFormDialog";
import { SparePartFormDialog } from "@/components/spare-parts/SparePartFormDialog";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

export function QuickAddErpMenu() {
  const { currentOrgId } = useCurrentOrganization();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sparePartOpen, setSparePartOpen] = useState(false);

  if (!currentOrgId) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-white/10 relative"
            aria-label="Быстро добавить"
            title="Быстро добавить"
          >
            <Plus className="h-5 w-5" />
            <Sparkles className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-primary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Добавить с AI
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setFilterOpen(true)}>
            <Filter className="h-4 w-4 mr-2" />
            Фильтрующий элемент
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSparePartOpen(true)}>
            <Wrench className="h-4 w-4 mr-2" />
            Запасная часть
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FilterElementFormDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        orgId={currentOrgId}
      />
      <SparePartFormDialog
        open={sparePartOpen}
        onOpenChange={setSparePartOpen}
        orgId={currentOrgId}
      />
    </>
  );
}
