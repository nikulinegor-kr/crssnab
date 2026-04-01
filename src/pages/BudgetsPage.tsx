import { Wallet, BarChart3, Target, CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function BudgetsPage() {
  const plannedFeatures = [
    { icon: Target, title: "Планирование бюджетов", desc: "Установка лимитов по объектам, категориям и периодам" },
    { icon: BarChart3, title: "Аналитика план/факт", desc: "Сравнение плановых и фактических расходов в реальном времени" },
    { icon: CalendarClock, title: "Контроль сроков", desc: "Уведомления при приближении к лимитам или срокам" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Бюджеты</h1>
        <Badge variant="secondary" className="text-xs font-medium">Скоро</Badge>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Модуль бюджетирования</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Мы работаем над инструментами для управления бюджетами. Следите за обновлениями — модуль скоро будет доступен.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plannedFeatures.map((f) => (
          <Card key={f.title}>
            <CardContent className="p-5 flex gap-3 items-start">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <f.icon className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
