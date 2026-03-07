import { Wallet } from "lucide-react";

export default function BudgetsPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Бюджеты</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Wallet className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold text-muted-foreground">Модуль в разработке</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Здесь будет управление бюджетами: планирование расходов, контроль лимитов по объектам и категориям, аналитика план/факт.
        </p>
      </div>
    </div>
  );
}
