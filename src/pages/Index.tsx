import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Users, Shield, ArrowRight, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: FileText,
      title: "Управление заявками",
      description: "Создавайте, отслеживайте и управляйте всеми заявками в одном месте с интуитивным интерфейсом."
    },
    {
      icon: BarChart3,
      title: "Аналитика и отчёты",
      description: "Получайте детальную статистику по заявкам и исполнителям для принятия обоснованных решений."
    },
    {
      icon: Users,
      title: "Командная работа",
      description: "Назначайте ответственных и отслеживайте прогресс в реальном времени для эффективного сотрудничества."
    },
    {
      icon: Shield,
      title: "Безопасность данных",
      description: "Контроль доступа и защита конфиденциальной информации с современными методами шифрования."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* TopNavBar */}
      <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-white/10 px-6 py-4 glassmorphism rounded-lg mx-4 mt-4 sm:mx-6 lg:mx-10">
        <div className="flex items-center gap-4">
          <div className="size-6 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path 
                clipRule="evenodd" 
                d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" 
                fill="currentColor" 
                fillRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-white text-xl font-bold leading-tight tracking-[-0.015em]">
            CRSS
          </h2>
        </div>
        <div className="hidden md:flex flex-1 justify-end gap-8">
          <div className="flex items-center gap-9">
            <a className="text-white/80 hover:text-white transition-colors text-sm font-medium leading-normal" href="#features">
              Возможности
            </a>
            <a className="text-white/80 hover:text-white transition-colors text-sm font-medium leading-normal" href="#pricing">
              Тарифы
            </a>
            <a className="text-white/80 hover:text-white transition-colors text-sm font-medium leading-normal" href="#faq">
              О системе
            </a>
          </div>
          <Button 
            onClick={() => navigate("/auth")}
            className="min-w-[84px] h-10 px-4 bg-primary text-white hover:bg-primary/90"
          >
            Войти
          </Button>
        </div>
        <div className="md:hidden">
          <Button 
            onClick={() => navigate("/auth")}
            size="sm"
            className="bg-primary text-white hover:bg-primary/90"
          >
            Войти
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col gap-20 md:gap-24 lg:gap-32 mt-16 px-4 md:px-10 lg:px-20">
        {/* HeroSection */}
        <section className="flex flex-col gap-6 text-center items-center py-10 max-w-[1100px] mx-auto">
          <div className="flex flex-col gap-4">
            <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em] md:text-5xl lg:text-6xl max-w-4xl">
              Оптимизируйте управление корпоративными ресурсами
            </h1>
            <h2 className="text-white/70 text-base font-normal leading-normal md:text-lg max-w-2xl mx-auto">
              CRSS предоставляет мощную интегрированную платформу для управления ресурсами, автоматизации процессов и получения критической аналитики для максимальной эффективности.
            </h2>
          </div>
          <div className="flex flex-wrap gap-4 justify-center mt-6">
            <Button 
              onClick={() => navigate("/auth")}
              className="h-12 px-6 bg-primary text-white text-base font-bold hover:bg-primary/90 shadow-lg"
            >
              Начать работу
            </Button>
            <Button 
              onClick={() => navigate("/demo?demo=true")}
              variant="outline"
              className="h-12 px-6 bg-white/10 border-white/20 text-white text-base font-bold hover:bg-white/20"
            >
              Попробовать демо
            </Button>
          </div>
          <div className="w-full mt-12">
            <div className="relative w-full aspect-video glassmorphism rounded-xl border border-white/10 shadow-2xl shadow-primary/10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background flex items-center justify-center">
                <div className="text-center space-y-4">
                  <PlayCircle className="h-20 w-20 text-primary mx-auto animate-pulse" />
                  <p className="text-white/60 text-sm">Демонстрация системы</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FeatureSection */}
        <section id="features" className="flex flex-col gap-10 max-w-[1100px] mx-auto w-full">
          <div className="flex flex-col gap-3 text-center items-center">
            <h2 className="text-white tracking-tight text-3xl font-bold leading-tight md:text-4xl">
              Почему выбирают CRSS?
            </h2>
            <p className="text-white/70 text-base font-normal leading-normal max-w-2xl">
              Откройте непревзойденную эффективность, контроль и аналитику с нашей передовой системой управления, разработанной для современных предприятий.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="flex flex-col gap-4 p-6 glassmorphism hover:border-primary/50 transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-white text-lg font-bold leading-normal mb-1">
                      {feature.title}
                    </p>
                    <p className="text-white/60 text-sm font-normal leading-normal">
                      {feature.description}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Stats Section */}
        <section className="max-w-[1100px] mx-auto w-full">
          <div className="glassmorphism rounded-xl p-8 md:p-12">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-black text-primary mb-2">500+</div>
                <div className="text-white/70 text-sm">Активных организаций</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-black text-primary mb-2">99.9%</div>
                <div className="text-white/70 text-sm">Время безотказной работы</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-black text-primary mb-2">24/7</div>
                <div className="text-white/70 text-sm">Поддержка пользователей</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="w-full bg-primary/90 rounded-xl p-8 md:p-12 text-center flex flex-col items-center gap-6 max-w-[1100px] mx-auto">
          <h2 className="text-white text-3xl md:text-4xl font-bold max-w-2xl">
            Трансформируйте управление вашими ресурсами уже сегодня
          </h2>
          <p className="text-white/80 max-w-xl">
            Готовы взять контроль? Начните работу с CRSS и раскройте весь потенциал ваших корпоративных ресурсов.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mt-2">
            <Button 
              onClick={() => navigate("/auth")}
              className="h-12 px-6 bg-white text-primary text-base font-bold hover:bg-white/90"
            >
              Начать сейчас
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={() => navigate("/demo?demo=true")}
              variant="outline"
              className="h-12 px-6 bg-transparent border-2 border-white text-white text-base font-bold hover:bg-white/10"
            >
              Попробовать демо
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-20 md:mt-24 lg:mt-32 border-t border-white/10 pt-10 pb-8 px-4 md:px-10 lg:px-20">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3">
                <div className="size-6 text-primary">
                  <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path 
                      clipRule="evenodd" 
                      d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" 
                      fill="currentColor" 
                      fillRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-white text-xl font-bold">CRSS</h2>
              </div>
              <p className="text-white/60 text-sm mt-4">
                Будущее управления корпоративными ресурсами.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:col-span-3 gap-8">
              <div>
                <h4 className="font-semibold text-white mb-4">Продукт</h4>
                <ul className="space-y-3">
                  <li>
                    <a className="text-white/60 hover:text-white text-sm transition-colors" href="#features">
                      Возможности
                    </a>
                  </li>
                  <li>
                    <a className="text-white/60 hover:text-white text-sm transition-colors" href="#pricing">
                      Тарифы
                    </a>
                  </li>
                  <li>
                    <button 
                      onClick={() => navigate("/demo?demo=true")}
                      className="text-white/60 hover:text-white text-sm transition-colors text-left"
                    >
                      Демо
                    </button>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-4">Компания</h4>
                <ul className="space-y-3">
                  <li>
                    <a className="text-white/60 hover:text-white text-sm transition-colors" href="#faq">
                      О нас
                    </a>
                  </li>
                  <li>
                    <a className="text-white/60 hover:text-white text-sm transition-colors" href="#faq">
                      Контакты
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-4">Поддержка</h4>
                <ul className="space-y-3">
                  <li>
                    <a className="text-white/60 hover:text-white text-sm transition-colors" href="#faq">
                      FAQ
                    </a>
                  </li>
                  <li>
                    <a className="text-white/60 hover:text-white text-sm transition-colors" href="#faq">
                      Документация
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-8 border-t border-white/10">
            <p className="text-center text-white/40 text-sm">
              © 2024 CRSS. Все права защищены.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
