import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Users, Shield, TrendingUp, Lock, CheckCircle, Zap, Clock, Target, ChevronDown, HelpCircle, ArrowRight, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type SubscriptionPlan = Tables<"subscription_plans">;

const Index = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ requests: 0, uptime: 0, years: 0 });
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-in");
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll(".scroll-animate");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Fetch subscription plans
  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });
      
      if (data) {
        setPlans(data);
      }
    };

    fetchPlans();
  }, []);

  // Animated counters
  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setCounts({
        requests: Math.floor(500 * progress),
        uptime: Math.floor(247 * progress),
        years: Math.floor(5 * progress)
      });

      if (step >= steps) {
        clearInterval(timer);
        setCounts({ requests: 500, uptime: 247, years: 5 });
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const features = [
    {
      icon: FileText,
      title: "Управление заявками",
      description: "Создавайте, отслеживайте и управляйте всеми заявками в одном месте",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: BarChart3,
      title: "Аналитика и отчёты",
      description: "Получайте детальную статистику по заявкам и исполнителям",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Users,
      title: "Командная работа",
      description: "Назначайте ответственных и отслеживайте прогресс в реальном времени",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: Shield,
      title: "Безопасность данных",
      description: "Контроль доступа и защита конфиденциальной информации",
      color: "from-green-500 to-emerald-500"
    }
  ];

  const workflow = [
    {
      icon: CheckCircle,
      title: "Создайте заявку",
      description: "Быстрое создание заявки с необходимой информацией"
    },
    {
      icon: Users,
      title: "Назначьте исполнителя",
      description: "Распределите задачи между сотрудниками"
    },
    {
      icon: Clock,
      title: "Отслеживайте прогресс",
      description: "Следите за статусом выполнения в реальном времени"
    },
    {
      icon: Target,
      title: "Завершите успешно",
      description: "Получите результат и аналитику"
    }
  ];

  const faqItems = [
    {
      question: "Как начать работу с системой?",
      answer: "Зарегистрируйтесь, создайте организацию и начните добавлять заявки. Процесс занимает менее 5 минут."
    },
    {
      question: "Есть ли мобильная версия?",
      answer: "Да, система полностью адаптивна и отлично работает на всех устройствах - телефонах, планшетах и компьютерах."
    },
    {
      question: "Как обеспечивается безопасность данных?",
      answer: "Мы используем современные методы шифрования, разграничение прав доступа и регулярное резервное копирование данных."
    },
    {
      question: "Можно ли интегрировать систему с другими сервисами?",
      answer: "Да, система поддерживает интеграции с Telegram для уведомлений, экспорт в Excel и другие популярные инструменты."
    },
    {
      question: "Сколько пользователей может работать одновременно?",
      answer: "Система поддерживает неограниченное количество пользователей с гибкой системой ролей и прав доступа."
    }
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background gradients */}
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5"></div>
        <div className="absolute top-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-20 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/90 border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                CRSS
              </h1>
              <nav className="hidden md:flex items-center gap-6">
                <button
                  onClick={() => scrollToSection("features")}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Возможности
                </button>
                <button
                  onClick={() => scrollToSection("workflow")}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Как работает
                </button>
                <button
                  onClick={() => scrollToSection("pricing")}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Тарифы
                </button>
                <button
                  onClick={() => scrollToSection("faq")}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  FAQ
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button 
                onClick={() => navigate("/auth")}
                className="shadow-md hover:shadow-lg transition-shadow"
              >
                Войти
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="relative">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="text-center space-y-6 animate-fade-in">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
                  Система управления заявками для вашего бизнеса
                </span>
              </h1>
            </div>
            
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
              Оптимизируйте процессы, повышайте эффективность и контролируйте выполнение задач в режиме реального времени
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button 
                size="lg" 
                onClick={() => navigate("/demo")}
                className="text-base font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              >
                Демо-версия
                <TrendingUp className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => scrollToSection("features")}
                className="text-base font-semibold border-2"
              >
                Узнать больше
                <ChevronDown className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={index}
                  className="scroll-animate group relative p-4 sm:p-6 h-full flex flex-col hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-lg`}></div>
                  
                  <div className="relative flex flex-col items-center text-center space-y-3 sm:space-y-4 flex-1">
                    <div className={`bg-gradient-to-br ${feature.color} text-white p-2.5 sm:p-3 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="space-y-2 flex-1 flex flex-col">
                      <h3 className="text-base sm:text-lg font-bold group-hover:text-primary transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8 sm:mb-10 scroll-animate">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-3">
              <Zap className="h-4 w-4" />
              Простой процесс работы
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Как это работает?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Всего четыре простых шага отделяют вас от эффективного управления заявками
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 relative">
            <div className="hidden lg:block absolute top-16 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20"></div>
            
            {workflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative scroll-animate" style={{ animationDelay: `${index * 100}ms` }}>
                  <Card className="p-4 sm:p-6 text-center h-full flex flex-col hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
                    <div className="relative inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground mb-3 sm:mb-4 group-hover:scale-110 transition-transform mx-auto">
                      <Icon className="h-6 w-6 sm:h-8 sm:w-8" />
                      <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-accent text-accent-foreground text-xs sm:text-sm font-bold flex items-center justify-center shadow-md">
                        {index + 1}
                      </div>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold mb-2">{step.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{step.description}</p>
                  </Card>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8 sm:mb-10 scroll-animate">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-3">
              <TrendingUp className="h-4 w-4" />
              Прозрачное ценообразование
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Выберите подходящий тариф
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Первый месяц бесплатно для всех новых пользователей
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => {
              const features = Array.isArray(plan.features) ? plan.features : [];
              const isPopular = plan.slug === "professional";
              
              return (
                <Card 
                  key={plan.id} 
                  className={`flex flex-col relative transition-all duration-300 hover:-translate-y-1 ${
                    isPopular
                      ? "border-2 border-primary shadow-xl scale-105" 
                      : "hover:shadow-lg"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-sm font-bold px-4 py-1 rounded-full shadow-md">
                      Популярный
                    </div>
                  )}
                  
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                    <CardDescription className="text-base">{plan.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1 space-y-6">
                    <div className="text-center py-4">
                      <span className="text-5xl font-bold">{plan.price_monthly}₽</span>
                      <span className="text-muted-foreground text-lg">/месяц</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">До {plan.max_users} пользователей</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">До {plan.max_requests_per_month} заявок/месяц</span>
                      </div>
                      {features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{String(feature)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      className="w-full font-semibold" 
                      onClick={() => navigate("/auth")}
                      variant={isPopular ? "default" : "outline"}
                    >
                      Начать
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8 sm:mb-10 scroll-animate">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-3">
              <HelpCircle className="h-4 w-4" />
              Часто задаваемые вопросы
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Ответы на ваши вопросы
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Всё, что вам нужно знать о системе управления заявками
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqItems.map((item, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="border border-border rounded-xl px-6 hover:shadow-md transition-all"
                >
                  <AccordionTrigger className="text-left font-semibold hover:text-primary hover:no-underline py-4">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Stats Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 border-0 shadow-2xl scroll-animate">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
            
            <CardContent className="relative p-6 sm:p-10">
              <div className="text-center mb-8 sm:mb-10">
                <h2 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-2">
                  Доверьтесь цифрам
                </h2>
                <p className="text-primary-foreground/90 text-base sm:text-lg">
                  Результаты, которыми мы гордимся
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center">
                <div className="p-4 sm:p-6 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/15 transition-all hover:scale-105 group">
                  <div className="flex flex-col items-center gap-2 mb-2 sm:mb-4">
                    <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground group-hover:animate-pulse" />
                    <p className="text-4xl sm:text-5xl font-bold text-primary-foreground">{counts.requests}+</p>
                  </div>
                  <p className="text-sm sm:text-base text-primary-foreground/90 font-medium">Заявок обработано</p>
                </div>
                
                <div className="p-4 sm:p-6 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/15 transition-all hover:scale-105 group">
                  <div className="flex flex-col items-center gap-2 mb-2 sm:mb-4">
                    <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground group-hover:animate-pulse" />
                    <p className="text-4xl sm:text-5xl font-bold text-primary-foreground">{counts.years}+</p>
                  </div>
                  <p className="text-sm sm:text-base text-primary-foreground/90 font-medium">Лет успешной работы</p>
                </div>
                
                <div className="p-4 sm:p-6 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/15 transition-all hover:scale-105 group">
                  <div className="flex flex-col items-center gap-2 mb-2 sm:mb-4">
                    <Lock className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground group-hover:animate-pulse" />
                    <p className="text-4xl sm:text-5xl font-bold text-primary-foreground">24/7</p>
                  </div>
                  <p className="text-sm sm:text-base text-primary-foreground/90 font-medium">Доступность системы</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Final CTA */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center space-y-6 scroll-animate">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Готовы начать?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Присоединяйтесь к компаниям, которые уже упростили управление заявками
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="text-base font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                Начать работу
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/demo")}
                className="text-base font-semibold border-2"
              >
                Открыть демо
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
