import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, Users, FileText } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface SubscriptionSettingsProps {
  organizationId: string;
}

export const SubscriptionSettings = ({ organizationId }: SubscriptionSettingsProps) => {
  const { status, limits, loading, isTrial, isActive, trialEndsAt } = useSubscription();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = () => {
    if (isTrial) {
      return <Badge variant="outline">Пробный период</Badge>;
    }
    if (isActive) {
      return <Badge variant="default">Активна</Badge>;
    }
    return <Badge variant="destructive">Истекла</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Текущая подписка</CardTitle>
          </div>
          <CardDescription>
            Информация о вашем тарифном плане
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Статус подписки</p>
              <p className="text-2xl font-bold mt-1">{limits?.plan_name || "Не активна"}</p>
            </div>
            {getStatusBadge()}
          </div>

          {isTrial && trialEndsAt && (
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">
                Пробный период заканчивается:{" "}
                <span className="font-medium text-foreground">
                  {format(new Date(trialEndsAt), "d MMMM yyyy", { locale: ru })}
                </span>
              </p>
            </div>
          )}

          {limits && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Пользователей</p>
                  <p className="text-lg font-semibold">
                    {limits.max_users === null ? "Безлимит" : limits.max_users}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Заявок в месяц</p>
                  <p className="text-lg font-semibold">
                    {limits.max_requests_per_month === null ? "Безлимит" : limits.max_requests_per_month}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Хотите изменить тарифный план или управлять подпиской?
            </p>
            <Button variant="outline" disabled>
              Управление подпиской
            </Button>
            <p className="text-xs text-muted-foreground">
              Функционал управления подпиской будет доступен в следующих версиях
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
