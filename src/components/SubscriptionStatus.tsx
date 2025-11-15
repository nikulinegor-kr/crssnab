import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export const SubscriptionStatus = () => {
  const { status, limits, isTrial, trialEndsAt } = useSubscription();
  const navigate = useNavigate();

  const getStatusBadge = () => {
    if (isTrial) return <Badge variant="secondary">Пробный период</Badge>;
    if (status === "active") return <Badge variant="default">Активна</Badge>;
    if (status === "expired" || status === "canceled") {
      return <Badge variant="destructive">Истекла</Badge>;
    }
    return <Badge variant="outline">Не активна</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Подписка
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {limits ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">План:</span>
              <span className="font-medium">{limits.plan_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Пользователей:</span>
              <span className="font-medium">До {limits.max_users}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Заявок в месяц:</span>
              <span className="font-medium">До {limits.max_requests_per_month}</span>
            </div>
            {isTrial && trialEndsAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Пробный период до:</span>
                <span className="font-medium">
                  {new Date(trialEndsAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Подписка не активна</p>
        )}
        
        <Button 
          className="w-full" 
          onClick={() => navigate("/pricing")}
          variant={status === "active" ? "outline" : "default"}
        >
          {status === "active" ? "Изменить план" : "Выбрать план"}
        </Button>
      </CardContent>
    </Card>
  );
};
