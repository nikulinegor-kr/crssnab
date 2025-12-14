import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useViewSettings } from "@/hooks/useViewSettings";
import { RotateCcw, LayoutDashboard, Columns3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const ViewSettings = () => {
  const { settings, updateDashboardSettings, updateKanbanSettings, resetToDefault } = useViewSettings();
  const { toast } = useToast();

  const handleReset = () => {
    resetToDefault();
    toast({
      title: "Настройки сброшены",
      description: "Настройки отображения восстановлены по умолчанию",
    });
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <CardTitle>Настройки Dashboard</CardTitle>
          </div>
          <CardDescription>
            Выберите какие виджеты показывать на главной странице
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="showStatsCards"
                checked={settings.dashboard.showStatsCards}
                onCheckedChange={(checked) => 
                  updateDashboardSettings({ showStatsCards: !!checked })
                }
              />
              <Label htmlFor="showStatsCards" className="cursor-pointer">
                Карточки статистики
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="showAnalyticsTabs"
                checked={settings.dashboard.showAnalyticsTabs}
                onCheckedChange={(checked) => 
                  updateDashboardSettings({ showAnalyticsTabs: !!checked })
                }
              />
              <Label htmlFor="showAnalyticsTabs" className="cursor-pointer">
                Аналитика (графики)
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="showCalendarWidget"
                checked={settings.dashboard.showCalendarWidget}
                onCheckedChange={(checked) => 
                  updateDashboardSettings({ showCalendarWidget: !!checked })
                }
              />
              <Label htmlFor="showCalendarWidget" className="cursor-pointer">
                Виджет календаря
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="showEmergencyWidget"
                checked={settings.dashboard.showEmergencyWidget}
                onCheckedChange={(checked) => 
                  updateDashboardSettings({ showEmergencyWidget: !!checked })
                }
              />
              <Label htmlFor="showEmergencyWidget" className="cursor-pointer">
                Аварийные заявки
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="showRecentRequests"
                checked={settings.dashboard.showRecentRequests}
                onCheckedChange={(checked) => 
                  updateDashboardSettings({ showRecentRequests: !!checked })
                }
              />
              <Label htmlFor="showRecentRequests" className="cursor-pointer">
                Последние заявки
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Columns3 className="h-5 w-5 text-primary" />
            <CardTitle>Настройки Kanban</CardTitle>
          </div>
          <CardDescription>
            Выберите какие поля показывать на карточках заявок
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="showRequestNumber"
                checked={settings.kanban.showRequestNumber}
                onCheckedChange={(checked) => 
                  updateKanbanSettings({ showRequestNumber: !!checked })
                }
              />
              <Label htmlFor="showRequestNumber" className="cursor-pointer">
                Номер заявки
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="showPriority"
                checked={settings.kanban.showPriority}
                onCheckedChange={(checked) => 
                  updateKanbanSettings({ showPriority: !!checked })
                }
              />
              <Label htmlFor="showPriority" className="cursor-pointer">
                Приоритет
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="showDeadline"
                checked={settings.kanban.showDeadline}
                onCheckedChange={(checked) => 
                  updateKanbanSettings({ showDeadline: !!checked })
                }
              />
              <Label htmlFor="showDeadline" className="cursor-pointer">
                Срок доставки
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="showExecutor"
                checked={settings.kanban.showExecutor}
                onCheckedChange={(checked) => 
                  updateKanbanSettings({ showExecutor: !!checked })
                }
              />
              <Label htmlFor="showExecutor" className="cursor-pointer">
                Исполнитель
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="showApplicant"
                checked={settings.kanban.showApplicant}
                onCheckedChange={(checked) => 
                  updateKanbanSettings({ showApplicant: !!checked })
                }
              />
              <Label htmlFor="showApplicant" className="cursor-pointer">
                Заявитель
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="showContractor"
                checked={settings.kanban.showContractor}
                onCheckedChange={(checked) => 
                  updateKanbanSettings({ showContractor: !!checked })
                }
              />
              <Label htmlFor="showContractor" className="cursor-pointer">
                Подрядчик
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Сбросить настройки
        </Button>
      </div>
    </div>
  );
};
