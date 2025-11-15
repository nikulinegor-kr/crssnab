import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import type { Tables } from "@/integrations/supabase/types";

type SubscriptionPlan = Tables<"subscription_plans">;

export default function Pricing() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentOrgId } = useCurrentOrganization();

  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });

      if (error) {
        console.error("Error fetching plans:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить тарифы",
          variant: "destructive",
        });
      } else {
        setPlans(data || []);
      }
      setLoading(false);
    };

    fetchPlans();
  }, [toast]);

  const handleSelectPlan = async (planId: string) => {
    if (!currentOrgId) {
      toast({
        title: "Ошибка",
        description: "Необходимо войти в организацию",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Скоро будет доступно",
      description: "Интеграция с платежной системой в разработке",
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 flex justify-center">
        <div className="text-muted-foreground">Загрузка тарифов...</div>
      </div>
    );
  }

  return (
    <div className="py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Выберите тариф</h1>
        <p className="text-xl text-muted-foreground">
          Первый месяц бесплатно для всех новых пользователей
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const features = Array.isArray(plan.features) ? plan.features : [];
          
          return (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price_monthly}₽</span>
                  <span className="text-muted-foreground">/месяц</span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>До {plan.max_users} пользователей</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>До {plan.max_requests_per_month} заявок/месяц</span>
                  </div>
                  {features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary" />
                      <span>{String(feature)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handleSelectPlan(plan.id)}
                  variant={plan.slug === "professional" ? "default" : "outline"}
                >
                  Выбрать план
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
