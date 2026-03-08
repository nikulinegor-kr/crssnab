import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ColumnVisibility {
  request_date: boolean;
  description: boolean;
  priority: boolean;
  status: boolean;
  availability: boolean;
  contractor: boolean;
  invoice_number: boolean;
  payment_percentage: boolean;
  shipment_date: boolean;
  delivery_date: boolean;
  transport_company: boolean;
  amount: boolean;
  applicant: boolean;
  comments: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  request_date: true,
  description: true,
  priority: true,
  status: true,
  availability: false,
  contractor: true,
  invoice_number: true,
  payment_percentage: true,
  shipment_date: true,
  delivery_date: true,
  transport_company: true,
  amount: true,
  applicant: true,
  comments: true,
};

const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
  request_date: "Дата",
  description: "Заявка",
  priority: "Приоритет",
  status: "Статус",
  availability: "Наличие",
  contractor: "Контрагент",
  invoice_number: "Счёт",
  payment_percentage: "Оплата",
  shipment_date: "Отгрузка",
  delivery_date: "Приход",
  transport_company: "ТК",
  amount: "Стоимость",
  applicant: "Заявитель",
  comments: "Комментарий",
};

interface TableColumnSettingsProps {
  visibility: ColumnVisibility;
  onVisibilityChange: (visibility: ColumnVisibility) => void;
}

export const TableColumnSettings = ({
  visibility,
  onVisibilityChange,
}: TableColumnSettingsProps) => {
  const handleToggle = (column: keyof ColumnVisibility) => {
    onVisibilityChange({
      ...visibility,
      [column]: !visibility[column],
    });
  };

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
        </div>
      </PopoverContent>
    </Popover>
  );
};
