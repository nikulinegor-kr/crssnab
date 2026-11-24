import { Layers, ListTree, SlidersHorizontal } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableColumnSettings, type ColumnVisibility } from "./TableColumnSettings";

export interface RequestsViewControlsProps {
  mobile?: boolean;
  groupByObject: boolean;
  groupByPhase: boolean;
  onGroupByObject: (value: boolean) => void;
  onGroupByPhase: (value: boolean) => void;
  visibility: ColumnVisibility;
  onVisibilityChange: (visibility: ColumnVisibility) => void;
  onResetColumns: () => void;
}

export function RequestsViewControls({
  mobile = false,
  groupByObject,
  groupByPhase,
  onGroupByObject,
  onGroupByPhase,
  visibility,
  onVisibilityChange,
  onResetColumns,
}: RequestsViewControlsProps) {
  if (mobile) return (
    <Toggle
      pressed={groupByPhase}
      onPressedChange={onGroupByPhase}
      size="sm"
      aria-label="Группировать по фазам"
      className="min-h-9 shrink-0 gap-1.5 border border-input px-2 text-xs data-[state=on]:border-primary/25 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
    >
      <ListTree className="size-3.5" aria-hidden="true" />По фазам
    </Toggle>
  );

  const groupToggles = (compact = false) => (
    <>
      <Toggle
        pressed={groupByObject}
        onPressedChange={onGroupByObject}
        size="sm"
        aria-label="Группировать по объектам"
        className={compact ? "h-9 w-full justify-start gap-1.5 px-2 text-xs data-[state=on]:bg-primary/10 data-[state=on]:text-primary" : "h-8 gap-1 px-2 text-xs data-[state=on]:bg-primary/10 data-[state=on]:text-primary"}
      >
        <Layers className="h-3.5 w-3.5" />Группировать по объектам
      </Toggle>
      <Toggle
        pressed={groupByPhase}
        onPressedChange={onGroupByPhase}
        size="sm"
        aria-label="Группировать по фазам"
        className={compact ? "h-9 w-full justify-start gap-1.5 px-2 text-xs data-[state=on]:bg-primary/10 data-[state=on]:text-primary" : "h-8 gap-1 px-2 text-xs data-[state=on]:bg-primary/10 data-[state=on]:text-primary"}
      >
        <ListTree className="h-3.5 w-3.5" />По фазам
      </Toggle>
    </>
  );

  return (
    <>
      <div className="requests-view-desktop shrink-0 items-center gap-1" aria-label="Вид реестра">
        {groupToggles()}
        <TableColumnSettings visibility={visibility} onVisibilityChange={onVisibilityChange} onReset={onResetColumns} />
      </div>
      <div className="requests-view-compact shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-sm px-3 text-xs" aria-label="Вид">
              <SlidersHorizontal className="h-4 w-4" />Вид
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="z-50 w-[min(320px,calc(100vw-24px))] space-y-2 bg-background p-3">
            <div className="text-sm font-semibold">Вид реестра</div>
            <div className="space-y-1">{groupToggles(true)}</div>
            <div className="border-t border-border pt-2">
              <TableColumnSettings visibility={visibility} onVisibilityChange={onVisibilityChange} onReset={onResetColumns} alwaysShowLabel />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
