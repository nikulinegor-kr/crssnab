import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-border/50 px-6 py-4 glassmorphism rounded-lg mb-16">
            <div className="flex items-center gap-4">
              <div className="size-6 text-primary">
                <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-foreground text-xl font-bold leading-tight tracking-[-0.015em]">CRSS</h2>
            </div>
            <div className="hidden md:flex flex-1 justify-end gap-8">
              <div className="flex items-center gap-9">
                <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium leading-normal" href="#features">Возможности</a>
                <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium leading-normal" href="#pricing">Цены</a>
                <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium leading-normal" href="#about">О нас</a>
                <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium leading-normal" href="#contact">Контакты</a>
              </div>
              <Button onClick={() => navigate("/auth")} className="min-w-[84px] h-10 px-4">
                <span className="truncate">Войти</span>
              </Button>
            </div>
            <div className="md:hidden">
              <Button onClick={() => navigate("/auth")} size="sm">Войти</Button>
            </div>
          </header>

          <main className="flex flex-col gap-32">
            {/* Hero Section */}
            <section className="flex flex-col gap-8 text-center items-center py-10">
              <div className="flex flex-col gap-6 max-w-4xl mx-auto">
                <h1 className="text-foreground text-4xl font-black leading-tight tracking-[-0.033em] md:text-5xl lg:text-6xl">
                  Оптимизируйте цепочку поставок корпоративных ресурсов
                </h1>
                <h2 className="text-muted-foreground text-base font-normal leading-normal md:text-lg max-w-2xl mx-auto">
                  CRSS предоставляет мощную интегрированную платформу для управления ресурсами, автоматизации процессов и получения критически важных данных для максимальной эффективности.
                </h2>
              </div>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button onClick={() => navigate("/demo?demo=true")} className="h-12 px-6 text-base font-bold">
                  <span className="truncate">Запросить демо</span>
                </Button>
                <Button onClick={() => navigate("/auth")} variant="secondary" className="h-12 px-6 text-base font-bold">
                  <span className="truncate">Начать бесплатно</span>
                </Button>
              </div>
              <div className="w-full max-w-4xl mx-auto mt-8">
                <div className="relative w-full aspect-video glassmorphism rounded-xl border border-border shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-primary/90 rounded-full flex items-center justify-center shadow-lg">
                      <span className="material-symbols-outlined text-white text-4xl">play_arrow</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Features Section */}
            <section id="features" className="flex flex-col gap-10">
              <div className="flex flex-col gap-4 text-center max-w-3xl mx-auto">
                <h2 className="text-foreground text-3xl font-black leading-tight tracking-[-0.033em] md:text-4xl lg:text-5xl">
                  Основные возможности
                </h2>
                <p className="text-muted-foreground text-base md:text-lg">
                  Все, что нужно для эффективного управления вашей компанией
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    icon: "inventory_2",
                    title: "Управление запасами",
                    description: "Отслеживайте и оптимизируйте запасы в режиме реального времени"
                  },
                  {
                    icon: "local_shipping",
                    title: "Логистика",
                    description: "Оптимизируйте процессы доставки и отслеживания"
                  },
                  {
                    icon: "analytics",
                    title: "Аналитика",
                    description: "Получайте инсайты для принятия решений на основе данных"
                  },
                  {
                    icon: "groups",
                    title: "Управление персоналом",
                    description: "Координируйте работу команды и повышайте продуктивность"
                  },
                  {
                    icon: "receipt_long",
                    title: "Финансовый учет",
                    description: "Автоматизируйте бухгалтерию и финансовую отчетность"
                  },
                  {
                    icon: "integration_instructions",
                    title: "Интеграции",
                    description: "Подключайте существующие системы через API"
                  }
                ].map((feature, index) => (
                  <div key={index} className="flex flex-col gap-4 p-6 glassmorphism rounded-xl border border-border hover:border-primary/50 transition-all">
                    <span className="material-symbols-outlined text-primary text-5xl">
                      {feature.icon}
                    </span>
                    <h3 className="text-foreground text-xl font-bold leading-tight">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-normal">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Demo Video Section */}
            <section className="flex flex-col gap-10">
              <div className="flex flex-col gap-4 text-center max-w-3xl mx-auto">
                <h2 className="text-foreground text-3xl font-black leading-tight tracking-[-0.033em] md:text-4xl lg:text-5xl">
                  Увидьте систему в действии
                </h2>
                <p className="text-muted-foreground text-base md:text-lg">
                  Посмотрите, как CRSS помогает компаниям достигать большего
                </p>
              </div>
              <div className="w-full max-w-4xl mx-auto">
                <div className="relative w-full aspect-video glassmorphism rounded-xl border border-border shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer">
                      <span className="material-symbols-outlined text-white text-5xl">play_arrow</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Partners Section */}
            <section className="flex flex-col gap-10">
              <h2 className="text-foreground text-2xl font-bold leading-tight text-center">
                Нам доверяют ведущие компании
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center opacity-60">
                {["Компания 1", "Компания 2", "Компания 3", "Компания 4"].map((company, index) => (
                  <div key={index} className="text-muted-foreground text-xl font-bold">
                    {company}
                  </div>
                ))}
              </div>
            </section>

            {/* CTA Section */}
            <section className="flex flex-col gap-8 text-center items-center py-16 px-6 glassmorphism rounded-2xl border border-border">
              <div className="flex flex-col gap-4 max-w-2xl">
                <h2 className="text-foreground text-3xl font-black leading-tight tracking-[-0.033em] md:text-4xl">
                  Готовы начать?
                </h2>
                <p className="text-muted-foreground text-base md:text-lg">
                  Присоединяйтесь к тысячам компаний, которые уже используют CRSS для оптимизации своих процессов
                </p>
              </div>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button onClick={() => navigate("/demo?demo=true")} size="lg" className="text-base font-bold px-8">
                  Запросить демо
                </Button>
                <Button onClick={() => navigate("/auth")} variant="secondary" size="lg" className="text-base font-bold px-8">
                  Начать бесплатно
                </Button>
              </div>
            </section>
          </main>

          {/* Footer */}
          <footer className="mt-32 border-t border-border pt-12 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="size-6 text-primary">
                    <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                      <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-foreground text-xl font-bold">CRSS</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Управление ресурсами нового поколения
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-foreground font-bold text-sm">Продукт</h3>
                <div className="flex flex-col gap-2">
                  <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Возможности</a>
                  <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Цены</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Интеграции</a>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-foreground font-bold text-sm">Компания</h3>
                <div className="flex flex-col gap-2">
                  <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors text-sm">О нас</a>
                  <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Контакты</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Карьера</a>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-foreground font-bold text-sm">Ресурсы</h3>
                <div className="flex flex-col gap-2">
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Документация</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Блог</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Поддержка</a>
                </div>
              </div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-border">
              <p className="text-muted-foreground text-sm">
                © 2024 CRSS. Все права защищены.
              </p>
              <div className="flex gap-6">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Политика конфиденциальности
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Условия использования
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
