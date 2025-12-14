import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Settings2, RotateCcw } from "lucide-react";
import { useViewSettings, type DashboardSettings } from "@/hooks/useViewSettings";
import { Separator } from "@/components/ui/separator";

interface WidgetConfig {
  key: keyof DashboardSettings;
  label: string;
  description: string;
}

const widgets: WidgetConfig[] = [
  {
    key: "showStatsCards",
    label: "Карточки статистики",
    description: "Общее количество, новые сегодня, аварийные, выполненные",
  },
  {
    key: "showExpenseChart",
    label: "График расходов",
    description: "Диаграмма расходов по месяцам (только для руководства)",
  },
  {
    key: "showAnalyticsTabs",
    label: "Вкладки аналитики",
    description: "Обзор и производительность с графиками",
  },
  {
    key: "showCalendarWidget",
    label: "Виджет календаря",
    description: "Ближайшие события и дедлайны",
  },
  {
    key: "showEmergencyWidget",
    label: "Аварийные заявки",
    description: "Список срочных заявок требующих внимания",
  },
  {
    key: "showRecentRequests",
    label: "Последние заявки",
    description: "Список недавно созданных заявок",
  },
];

export const DashboardWidgetSettings = () => {
  const { settings, updateDashboardSettings, resetToDefault } = useViewSettings();
  const [open, setOpen] = useState(false);

  const handleToggle = (key: keyof DashboardSettings, value: boolean) => {
    updateDashboardSettings({ [key]: value });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Настроить виджеты
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Настройка дашборда</SheetTitle>
          <SheetDescription>
            Выберите виджеты, которые хотите видеть на главной странице
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {widgets.map((widget) => (
            <div key={widget.key} className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor={widget.key} className="text-sm font-medium">
                  {widget.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {widget.description}
                </p>
              </div>
              <Switch
                id={widget.key}
                checked={settings.dashboard[widget.key] ?? true}
                onCheckedChange={(checked) => handleToggle(widget.key, checked)}
              />
            </div>
          ))}
          
          <Separator />
          
          <Button
            variant="outline"
            onClick={resetToDefault}
            className="w-full gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Сбросить настройки
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
