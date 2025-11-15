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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-accent/10"></div>
        <div className="absolute top-20 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-20 w-[600px] h-[600px] bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Sticky Header with Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border/40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-primary">CRSS</h1>
              <nav className="hidden md:flex items-center gap-6">
                <button
                  onClick={() => scrollToSection("features")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Возможности
                </button>
                <button
                  onClick={() => scrollToSection("workflow")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Как работает
                </button>
                <button
                  onClick={() => scrollToSection("pricing")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Тарифы
                </button>
                <button
                  onClick={() => scrollToSection("faq")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  FAQ
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button 
                onClick={() => navigate("/auth")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Войти
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <div className="relative max-w-7xl mx-auto px-6 py-20">
        <div className="text-center space-y-8 mb-24 animate-fade-in">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
            <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
              CRSS
            </span>
            {" — "}
            <span className="text-foreground">Corporate Resource Supply System</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-medium mt-4">
            Система Управления Поставками Компании
          </p>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Современная система управления заявками для отдела снабжения. 
            <br />
            <span className="text-foreground font-medium">Упростите работу и повысьте эффективность команды.</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button 
              size="lg" 
              onClick={() => navigate("/dashboard?demo=true")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-10 py-6 text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              Открыть демо
              <TrendingUp className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => scrollToSection("features")}
              className="border-2 border-primary text-primary hover:bg-primary/10 font-semibold px-10 py-6 text-lg hover:border-primary/70 transition-all"
            >
              Узнать больше
              <ChevronDown className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index}
                className="scroll-animate group relative p-6 bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                
                <div className="relative">
                  <div className={`bg-gradient-to-br ${feature.color} text-white p-3 rounded-xl w-fit mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* How it works section */}
        <div id="workflow" className="mb-20 scroll-animate">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Zap className="h-4 w-4" />
              Простой процесс работы
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Как это работает?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Всего четыре простых шага отделяют вас от эффективного управления заявками
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Connection lines for desktop */}
            <div className="hidden lg:block absolute top-16 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20 -z-10"></div>
            
            {workflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative scroll-animate" style={{ animationDelay: `${index * 100}ms` }}>
                  <Card className="p-6 text-center hover:shadow-xl transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm group hover:-translate-y-2">
                    <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="h-8 w-8" />
                      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent text-accent-foreground text-sm font-bold flex items-center justify-center">
                        {index + 1}
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pricing Section */}
        <div id="pricing" className="mb-20 scroll-animate">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-primary text-sm font-medium mb-4">
              <TrendingUp className="h-4 w-4" />
              Прозрачное ценообразование
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Выберите подходящий тариф
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Первый месяц бесплатно для всех новых пользователей
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => {
              const features = Array.isArray(plan.features) ? plan.features : [];
              
              return (
                <Card 
                  key={plan.id} 
                  className={`flex flex-col relative overflow-hidden transition-all hover:scale-105 ${
                    plan.slug === "professional" 
                      ? "border-2 border-primary shadow-xl bg-primary/5" 
                      : "hover:shadow-lg"
                  }`}
                >
                  {plan.slug === "professional" && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                      Популярный
                    </div>
                  )}
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
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">До {plan.max_users} пользователей</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">До {plan.max_requests_per_month} заявок/месяц</span>
                      </div>
                      {features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-primary flex-shrink-0" />
                          <span className="text-sm">{String(feature)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      onClick={() => navigate("/auth")}
                      variant={plan.slug === "professional" ? "default" : "outline"}
                    >
                      Начать
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>

        {/* FAQ Section */}
        <div id="faq" className="mb-20 scroll-animate">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <HelpCircle className="h-4 w-4" />
              Часто задаваемые вопросы
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ответы на ваши вопросы
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Всё, что вам нужно знать о системе управления заявками
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqItems.map((item, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl px-6 hover:shadow-lg transition-all"
                >
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* Stats Section */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-3xl p-12 text-primary-foreground border-0 shadow-2xl scroll-animate mb-20">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
          
          <div className="relative">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Доверьтесь цифрам
              </h2>
              <p className="text-primary-foreground/80 text-lg">
                Результаты, которыми мы гордимся
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/15 transition-all hover:scale-105 group">
                <div className="flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 mr-2 group-hover:animate-pulse" />
                  <p className="text-5xl md:text-6xl font-bold">{counts.requests}+</p>
                </div>
                <p className="text-base opacity-90 font-medium">Заявок обработано</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/15 transition-all hover:scale-105 group">
                <div className="flex items-center justify-center mb-4">
                  <TrendingUp className="h-8 w-8 mr-2 group-hover:animate-pulse" />
                  <p className="text-5xl md:text-6xl font-bold">{counts.years}+</p>
                </div>
                <p className="text-base opacity-90 font-medium">Лет успешной работы</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/15 transition-all hover:scale-105 group">
                <div className="flex items-center justify-center mb-4">
                  <Lock className="h-8 w-8 mr-2 group-hover:animate-pulse" />
                  <p className="text-5xl md:text-6xl font-bold">24/7</p>
                </div>
                <p className="text-base opacity-90 font-medium">Доступность системы</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Final CTA Section */}
        <div className="text-center py-20 scroll-animate">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Готовы начать?
            </h2>
            <p className="text-xl text-muted-foreground">
              Присоединяйтесь к компаниям, которые уже упростили управление заявками
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-12 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
              >
                Начать работу
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/dashboard?demo=true")}
              className="border-2 border-primary text-primary hover:bg-primary/10 font-semibold px-12 py-6 text-lg transition-all"
            >
              Открыть демо
            </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
