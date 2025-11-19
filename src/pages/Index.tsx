import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-border/30 px-4 md:px-6 py-3 glassmorphism rounded-xl mb-12">
            <div className="flex items-center gap-3">
              <div className="size-5 text-primary">
                <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-foreground text-lg font-bold leading-tight">CRSS</h2>
            </div>
            <div className="hidden md:flex flex-1 justify-end gap-6">
              <nav className="flex items-center gap-7">
                <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium" href="#features">Возможности</a>
                <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium" href="#pricing">Цены</a>
                <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium" href="#about">О нас</a>
                <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium" href="#contact">Контакты</a>
              </nav>
              <Button onClick={() => navigate("/auth")} className="h-9 px-5 text-sm font-medium rounded-lg">
                Войти
              </Button>
            </div>
            <div className="md:hidden">
              <Button onClick={() => navigate("/auth")} size="sm" className="h-9 px-4 text-xs">Войти</Button>
            </div>
          </header>

          <main className="flex flex-col gap-24">
            {/* Hero Section */}
            <section className="flex flex-col gap-8 text-center items-center py-12">
              <div className="flex flex-col gap-5 max-w-3xl mx-auto">
                <h1 className="text-foreground text-[2.5rem] md:text-5xl lg:text-[3.5rem] font-black leading-[1.1] tracking-tight">
                  Оптимизируйте цепочку поставок корпоративных ресурсов
                </h1>
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-xl mx-auto px-4">
                  CRSS предоставляет мощную интегрированную платформу для управления ресурсами, автоматизации процессов и получения критически важных данных для максимальной эффективности.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={() => navigate("/demo?demo=true")} className="h-11 px-7 text-sm font-bold rounded-lg">
                  Запросить демо
                </Button>
                <Button onClick={() => navigate("/auth")} variant="secondary" className="h-11 px-7 text-sm font-bold rounded-lg">
                  Начать бесплатно
                </Button>
              </div>
              <div className="w-full max-w-5xl mx-auto mt-10">
                <div className="relative w-full aspect-[16/10] glassmorphism rounded-2xl border border-border shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-primary/90 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-primary-foreground text-4xl">play_arrow</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Features Section */}
            <section id="features" className="flex flex-col gap-12 py-12">
              <div className="flex flex-col gap-3 text-center max-w-2xl mx-auto">
                <h2 className="text-foreground text-3xl md:text-4xl font-black leading-tight">
                  Почему выбирают CRSS?
                </h2>
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                  Определите для себя непревзойдённую эффективность, контроль и надёжность с нашей передовой CRM-системой, разработанной для современного предприятия
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  {
                    icon: "settings",
                    title: "Автоматизация процессов",
                    description: "Оптимизируйте рабочие процессы и сократите ручной труд благодаря мощным инструментам для автоматизации множества задач"
                  },
                  {
                    icon: "analytics",
                    title: "Аналитика ресурсов",
                    description: "Получайте мгновенные аналитические данные и превращайте их в основанные на данных решения для оптимизации бизнеса"
                  },
                  {
                    icon: "workspace_premium",
                    title: "Управление поставщиками",
                    description: "Управляйте отношениями с поставщиками, отслеживайте контракты и оптимизируйте процесс закупок"
                  }
                ].map((feature, index) => (
                  <div key={index} className="flex flex-col gap-4 p-6 glassmorphism rounded-xl border border-border/50 hover:border-primary/30 transition-all text-center items-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-3xl">
                        {feature.icon}
                      </span>
                    </div>
                    <h3 className="text-foreground text-lg font-bold leading-tight">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Demo Video Section */}
            <section className="flex flex-col gap-10 py-12">
              <h2 className="text-foreground text-3xl md:text-4xl font-black text-center">
                Посмотрите в действии
              </h2>
              <div className="w-full max-w-5xl mx-auto">
                <div className="relative w-full aspect-video glassmorphism rounded-2xl border border-border shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-card/30"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform cursor-pointer">
                      <span className="material-symbols-outlined text-primary-foreground text-4xl">play_arrow</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Partners Section */}
            <section className="flex flex-col gap-10 py-8">
              <h2 className="text-foreground text-xl md:text-2xl font-bold text-center">
                Нам доверяют лидеры отрасли
              </h2>
              <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16 opacity-50">
                {[1, 2, 3, 4].map((_, index) => (
                  <div key={index} className="w-24 h-12 glassmorphism rounded-lg border border-border/30 flex items-center justify-center">
                    <span className="text-muted-foreground text-xs font-medium">Logo {index + 1}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA Section */}
            <section className="flex flex-col gap-6 text-center items-center py-16 px-8 md:px-12 bg-primary rounded-3xl shadow-2xl">
              <div className="flex flex-col gap-4 max-w-xl">
                <h2 className="text-primary-foreground text-2xl md:text-3xl font-black leading-tight">
                  Трансформируйте управление поставками уже сегодня
                </h2>
                <p className="text-primary-foreground/90 text-sm md:text-base leading-relaxed">
                  Готовы вывести свой бизнес на новый уровень? Начните работу с CRSS и открывайте для себя безграничные возможности оптимизации и контроля
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                <Button 
                  onClick={() => navigate("/demo?demo=true")} 
                  className="h-11 px-7 text-sm font-bold bg-background text-foreground hover:bg-background/90 rounded-lg"
                >
                  Запросить демо
                </Button>
                <Button 
                  onClick={() => navigate("/auth")} 
                  variant="outline"
                  className="h-11 px-7 text-sm font-bold border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 rounded-lg"
                >
                  Начать бесплатно
                </Button>
              </div>
            </section>
          </main>

          {/* Footer */}
          <footer className="mt-24 border-t border-border pt-10 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="size-5 text-primary">
                    <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                      <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-foreground text-lg font-bold">CRSS</span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Решение для управления корпоративными ресурсами
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-foreground font-bold text-xs uppercase tracking-wide">Продукт</h3>
                <div className="flex flex-col gap-2">
                  <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Возможности</a>
                  <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Цены</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Интеграции</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Демо</a>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-foreground font-bold text-xs uppercase tracking-wide">Компания</h3>
                <div className="flex flex-col gap-2">
                  <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors text-xs">О нас</a>
                  <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Контакты</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Карьера</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Блог</a>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-foreground font-bold text-xs uppercase tracking-wide">Правовая информация</h3>
                <div className="flex flex-col gap-2">
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Политика конфиденциальности</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Условия использования</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Cookies</a>
                </div>
              </div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t border-border/50">
              <p className="text-muted-foreground text-xs">
                © 2025 CRSS, Inc. Все права защищены
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <span className="material-symbols-outlined text-lg">language</span>
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <span className="material-symbols-outlined text-lg">forum</span>
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <span className="material-symbols-outlined text-lg">link</span>
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Index;
