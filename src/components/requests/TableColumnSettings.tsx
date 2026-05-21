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

export interface ColumnVisibility {
  request_date: boolean;
  description: boolean;
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
  request_date: true,
  description: true,
  priority: true,
  status: true,
  availability: false,
  contractor: true,
  invoice_number: false,
  payment_prepay: true,
  payment_percentage: true,
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
  request_date: "Дата",
  description: "Заявка",
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
  amount: "Стоимость",
  applicant: "Заявитель",
  executor: "Исполнитель",
  comments: "Комментарий",
  equipment: "Техника",
};

interface TableColumnSettingsProps {
  visibility: ColumnVisibility;
  onVisibilityChange: (visibility: ColumnVisibility) => void;
  onReset?: () => void;
}

export const TableColumnSettings = ({
  visibility,
  onVisibilityChange,
  onReset,
}: TableColumnSettingsProps) => {
  const handleToggle = (column: keyof ColumnVisibility) => {
    onVisibilityChange({
      ...visibility,
      [column]: !visibility[column],
    });
  };

  const isDefault = Object.keys(DEFAULT_COLUMN_VISIBILITY).every(
    (key) => visibility[key as keyof ColumnVisibility] === DEFAULT_COLUMN_VISIBILITY[key as keyof ColumnVisibility]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Колонки</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 bg-background border shadow-lg z-50" align="end">
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
