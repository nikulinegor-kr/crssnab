import { Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { RESIZABLE_COLUMNS, useTableColumnWidths, type ResizableColumn } from "@/hooks/useTableColumnWidths";

export interface ColumnVisibility {
  select: boolean;
  request_date: boolean;
  description: boolean;
  object: boolean;
  priority: boolean;
  status: boolean;
  availability: boolean;
  contractor: boolean;
  invoice_number: boolean;
  payment_prepay: boolean;
  payment_percentage: boolean;
  shipment_date: boolean;
  delivery_date: boolean;
  transport_company: boolean;
  waybill_number: boolean;
  amount: boolean;
  applicant: boolean;
  executor: boolean;
  comments: boolean;
  equipment: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  select: true,
  request_date: true,
  description: true,
  object: true,
  priority: false,
  status: true,
  availability: false,
  contractor: true,
  invoice_number: false,
  payment_prepay: false,
  payment_percentage: false,
  shipment_date: false,
  delivery_date: true,
  transport_company: false,
  waybill_number: false,
  amount: true,
  applicant: false,
  executor: true,
  comments: false,
  equipment: false,
};

const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
  select: "Чекбоксы выбора",
  request_date: "Дата",
  description: "Заявка",
  object: "Объект",
  priority: "Приоритет",
  status: "Статус",
  availability: "Наличие",
  contractor: "Контрагент",
  invoice_number: "Счёт",
  payment_prepay: "% предоплаты",
  payment_percentage: "Факт оплаты",
  shipment_date: "Отгрузка",
  delivery_date: "Приход",
  transport_company: "ТК",
  waybill_number: "№ТТН",
  amount: "Сумма",
  applicant: "Заявитель",
  executor: "Кто ведёт",
  comments: "Комментарий",
  equipment: "Техника",
};

interface TableColumnSettingsProps {
  visibility: ColumnVisibility;
  onVisibilityChange: (visibility: ColumnVisibility) => void;
  onReset?: () => void;
  alwaysShowLabel?: boolean;
}

export const TableColumnSettings = ({
  visibility,
  onVisibilityChange,
  onReset,
  alwaysShowLabel = false,
}: TableColumnSettingsProps) => {
  const handleToggle = (column: keyof ColumnVisibility) => {
    onVisibilityChange({
      ...visibility,
      [column]: !visibility[column],
    });
  };

  const { widths, updateWidth } = useTableColumnWidths();
  const isDefault = Object.keys(DEFAULT_COLUMN_VISIBILITY).every(
    (key) => visibility[key as keyof ColumnVisibility] === DEFAULT_COLUMN_VISIBILITY[key as keyof ColumnVisibility]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Settings2 className="h-4 w-4" />
          <span className={alwaysShowLabel ? "inline" : "hidden sm:inline"}>Колонки</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-h-[70dvh] overflow-y-auto bg-background border shadow-lg z-50" align="end">
        <div className="space-y-1">
          <h4 className="font-medium text-sm mb-3">Отображение колонок</h4>
          {(Object.keys(COLUMN_LABELS) as Array<keyof ColumnVisibility>).map((column) => (
            <div key={column} className="flex items-center gap-2 py-1">
              <Checkbox
                id={`col-${column}`}
                checked={visibility[column]}
                onCheckedChange={() => handleToggle(column)}
              />
              <Label
                htmlFor={`col-${column}`}
                className="text-sm font-normal cursor-pointer flex-1"
              >
                {COLUMN_LABELS[column]}
              </Label>
            </div>
          ))}
          <Separator className="my-2" />
          <h4 className="font-medium text-sm mb-1">Ширина колонок</h4>
          {(Object.keys(RESIZABLE_COLUMNS) as ResizableColumn[]).map((column) => (
            <div key={column} className="space-y-1.5 py-1">
              <div className="flex items-center justify-between text-sm">
                <span id={`col-width-${column}`}>{COLUMN_LABELS[column]}</span>
                <span className="font-numeric text-xs text-muted-foreground">{widths[column]} px</span>
              </div>
              <Slider
                aria-labelledby={`col-width-${column}`}
                aria-valuetext={`${widths[column]} пикселей`}
                min={RESIZABLE_COLUMNS[column].min}
                max={RESIZABLE_COLUMNS[column].max}
                step={10}
                value={[widths[column]]}
                onValueChange={([value]) => updateWidth(column, value)}
              />
            </div>
          ))}
          {onReset && (
            <>
              <Separator className="my-2" />
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                onClick={onReset}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Сбросить колонки
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
