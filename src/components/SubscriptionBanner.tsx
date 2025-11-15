import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Clock } from "lucide-react";

export const SubscriptionBanner = () => {
  const { status, isActive, isTrial, trialEndsAt } = useSubscription();
  const navigate = useNavigate();

  if (!status || isActive) {
    if (isTrial && trialEndsAt) {
      const daysLeft = Math.ceil(
        (new Date(trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysLeft <= 7) {
        return (
          <Alert className="mb-4">
            <Clock className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Пробный период заканчивается через {daysLeft} {daysLeft === 1 ? 'день' : 'дней'}
              </span>
              <Button size="sm" onClick={() => navigate("/pricing")}>
                Выбрать тариф
              </Button>
            </AlertDescription>
          </Alert>
        );
      }
    }
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Подписка истекла. Пожалуйста, выберите тариф для продолжения работы.</span>
        <Button size="sm" variant="outline" onClick={() => navigate("/pricing")}>
          Выбрать тариф
        </Button>
      </AlertDescription>
    </Alert>
  );
};
