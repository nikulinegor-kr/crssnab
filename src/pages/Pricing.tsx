import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Button from "@/components/landing/ui/Button";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { CheckCircle } from "lucide-react";
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка тарифов...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col">
          <Header />
          
          <main className="flex-1 py-12">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Прозрачные тарифы для<br />вашего бизнеса
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Выберите план, который идеально подходит для масштаба вашей компании и
                потребностей в управлении ресурсами.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
              {plans.map((plan, index) => {
                const features = Array.isArray(plan.features) ? plan.features : [];
                const isPopular = index === 1;
                
                return (
                  <div 
                    key={plan.id} 
                    className={`glassmorphism rounded-3xl p-8 flex flex-col relative ${
                      isPopular ? 'border-2 border-primary scale-105' : ''
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium">
                          Самый популярный
                        </span>
                      </div>
                    )}
                    
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                      <p className="text-muted-foreground text-sm">
                        {plan.description}
                      </p>
                    </div>
                    
                    <div className="mb-8">
                      <span className="text-5xl font-bold">{plan.price_monthly}₽</span>
                      <span className="text-muted-foreground">/месяц</span>
                    </div>
                    
                    <Button 
                      variant={isPopular ? "primary" : "outline"}
                      fullWidth
                      onClick={() => handleSelectPlan(plan.id)}
                      className="mb-8"
                    >
                      Выбрать план
                    </Button>
                    
                    <div className="space-y-4 flex-1">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">До {plan.max_users} пользователей</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">До {plan.max_requests_per_month} заявок в месяц</span>
                      </div>
                      {features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{String(feature)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
}
