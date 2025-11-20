import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Users,
  Calendar,
  MessageCircle,
  BarChart3,
  Sparkles,
  CheckCircle,
  Clock,
  TrendingUp,
  Zap,
  Shield,
  Workflow,
  Bell,
  FileBarChart
} from "lucide-react";

const SystemDemo = () => {
  const [activeFeature, setActiveFeature] = useState<string>("requests");
  const [demoProgress, setDemoProgress] = useState(0);

  const features = [
    {
      id: "requests",
      title: "Управление заявками",
      icon: <FileText className="h-5 w-5" />,
      description: "Создание, отслеживание и управление заявками с AI-помощником",
      metrics: { total: 248, active: 32, completed: 216 },
      highlights: [
        "AI анализ и категоризация заявок",
        "Автоматическое назначение исполнителей",
        "Отслеживание статусов в реальном времени",
        "История изменений и аудит"
      ]
    },
    {
      id: "suppliers",
      title: "Работа с поставщиками",
      icon: <Users className="h-5 w-5" />,
      description: "База поставщиков с полной информацией и историей взаимодействий",
      metrics: { total: 45, active: 42, inactive: 3 },
      highlights: [
        "Централизованная база контактов",
        "История заказов и платежей",
        "Рейтинг и оценка поставщиков",
        "Интеграция с учетной системой"
      ]
    },
    {
      id: "calendar",
      title: "Календарь событий",
      icon: <Calendar className="h-5 w-5" />,
      description: "Планирование доставок, встреч и важных событий",
      metrics: { thisWeek: 12, thisMonth: 48, upcoming: 156 },
      highlights: [
        "Синхронизация с заявками",
        "Напоминания о важных событиях",
        "Планирование поставок",
        "Совместный доступ команды"
      ]
    },
    {
      id: "chat",
      title: "Командный чат",
      icon: <MessageCircle className="h-5 w-5" />,
      description: "Внутренняя коммуникация с поддержкой файлов и уведомлений",
      metrics: { messages: 1243, activeChats: 8, participants: 15 },
      highlights: [
        "Приватные и групповые чаты",
        "Прикрепление файлов и документов",
        "Уведомления в реальном времени",
        "История переписки"
      ]
    },
    {
      id: "analytics",
      title: "Аналитика и отчеты",
      icon: <BarChart3 className="h-5 w-5" />,
      description: "Детальная аналитика работы и готовые отчеты",
      metrics: { reports: 24, insights: 156, efficiency: 94 },
      highlights: [
        "Визуализация данных в реальном времени",
        "Экспорт в Excel и PDF",
        "Настраиваемые дашборды",
        "Прогнозирование трендов"
      ]
    },
    {
      id: "ai",
      title: "AI Помощник",
      icon: <Sparkles className="h-5 w-5" />,
      description: "Интеллектуальная автоматизация и помощь в принятии решений",
      metrics: { suggestions: 89, automated: 156, accuracy: 96 },
      highlights: [
        "Автоматическая категоризация",
        "Предложение приоритетов",
        "Рекомендации исполнителей",
        "Анализ описаний заявок"
      ]
    }
  ];

  const systemAdvantages = [
    {
      icon: <Zap className="h-6 w-6 text-primary" />,
      title: "Быстрое внедрение",
      description: "Настройка системы за 1 день"
    },
    {
      icon: <Shield className="h-6 w-6 text-primary" />,
      title: "Безопасность",
      description: "Защита данных на уровне банков"
    },
    {
      icon: <Workflow className="h-6 w-6 text-primary" />,
      title: "Гибкость",
      description: "Настройка под ваши процессы"
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-primary" />,
      title: "Масштабируемость",
      description: "Растет вместе с бизнесом"
    }
  ];

  const currentFeature = features.find(f => f.id === activeFeature);

  const handleTryFeature = (featureId: string) => {
    setActiveFeature(featureId);
    setDemoProgress(prev => Math.min(prev + 16.67, 100));
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4">
        <Badge variant="secondary" className="mb-2">
          <Sparkles className="h-3 w-3 mr-1" />
          Интерактивная демонстрация
        </Badge>
        <h1 className="text-4xl font-black bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Система управления снабжением CRSS
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Комплексное решение для автоматизации закупок и управления поставками с интеграцией AI
        </p>
      </div>

      {/* Progress */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Прогресс изучения системы</span>
            <span className="text-primary">{Math.round(demoProgress)}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={demoProgress} className="h-2" />
        </CardContent>
      </Card>

      {/* Main Demo Area */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Feature List */}
        <div className="lg:col-span-1 space-y-2">
          <h2 className="text-xl font-bold mb-4">Возможности системы</h2>
          {features.map((feature) => (
            <Card
              key={feature.id}
              className={`cursor-pointer transition-all hover-scale ${
                activeFeature === feature.id
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => handleTryFeature(feature.id)}
            >
              <CardHeader className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    activeFeature === feature.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}>
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm">{feature.title}</CardTitle>
                  </div>
                  {activeFeature === feature.id && (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Feature Details */}
        <div className="lg:col-span-2 space-y-6">
          {currentFeature && (
            <>
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                      {currentFeature.icon}
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{currentFeature.title}</CardTitle>
                      <CardDescription className="text-base">
                        {currentFeature.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {Object.entries(currentFeature.metrics).map(([key, value]) => (
                      <div key={key} className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-3xl font-bold text-primary mb-1">{value}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Highlights */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Ключевые возможности
                    </h3>
                    <div className="grid gap-2">
                      {currentFeature.highlights.map((highlight, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm">{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Interactive Demo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Интерактивная демонстрация
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-8 text-center space-y-4">
                    <div className="inline-flex p-4 rounded-full bg-primary/10">
                      {currentFeature.icon}
                    </div>
                    <p className="text-muted-foreground">
                      Нажмите на другие модули слева, чтобы изучить все возможности системы
                    </p>
                    <Button className="gap-2">
                      <FileBarChart className="h-4 w-4" />
                      Запросить полную демонстрацию
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* System Advantages */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-center mb-8">Преимущества системы</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {systemAdvantages.map((advantage, index) => (
            <Card key={index} className="border-primary/20 hover-scale">
              <CardHeader>
                <div className="mb-3">{advantage.icon}</div>
                <CardTitle className="text-lg">{advantage.title}</CardTitle>
                <CardDescription>{advantage.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <Card className="border-primary bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold">Готовы начать?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Получите персональную демонстрацию системы и узнайте, как CRSS может оптимизировать ваши процессы снабжения
          </p>
          <div className="flex gap-3 justify-center">
            <Button size="lg" className="gap-2">
              <Bell className="h-4 w-4" />
              Запросить демо
            </Button>
            <Button size="lg" variant="outline">
              Связаться с нами
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemDemo;