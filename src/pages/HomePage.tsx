import { Link } from "react-router-dom";
import { Brain, LayoutGrid, Package, ShoppingCart, CheckCircle, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

const features = [
  {
    icon: Brain,
    title: "AI распознавание",
    description: "Автоматический ввод данных из сканов документов с помощью ИИ. Экономия времени до 70% на вводе накладных.",
  },
  {
    icon: LayoutGrid,
    title: "Управление объектами",
    description: "Контроль сроков, диаграмма Ганта и распределение ресурсов в реальном времени. Визуализация прогресса.",
  },
  {
    icon: Package,
    title: "Учет материалов",
    description: "Полный цикл движения ТМЦ от заявки до списания на объекте. Исключите потери и хищения материалов.",
  },
  {
    icon: ShoppingCart,
    title: "Склад и закупки",
    description: "Оптимизация цепочки поставок и контроль цен поставщиков. Автоматическое сравнение предложений.",
  },
];

const steps = [
  { num: "1", title: "Импорт данных", text: "Загрузите сметы и объекты из Excel или других систем за пару кликов." },
  { num: "2", title: "Настройка ролей", text: "Добавьте сотрудников: от прораба до директора, распределив права доступа." },
  { num: "3", title: "Полный контроль", text: "Получайте отчеты в реальном времени и управляйте стройкой онлайн." },
];

const checkpoints = [
  { title: "Таблица материалов", text: "Удобный интерфейс для работы с сотнями позиций номенклатуры. Фильтрация, поиск и группировка." },
  { title: "Закупки под контролем", text: "Сравнивайте цены поставщиков и выбирайте лучшие предложения автоматически." },
  { title: "Мобильное приложение", text: "Вносите данные прямо с объекта, даже без доступа к интернету." },
];

export default function HomePage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-border px-6 md:px-20 py-4 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3 text-primary">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
              <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-foreground text-xl font-bold leading-tight tracking-tight">CRSS CRM</h2>
        </div>
        <div className="hidden lg:flex flex-1 justify-center gap-8">
          <a className="text-muted-foreground text-sm font-medium hover:text-primary transition-colors" href="#features">Возможности</a>
          <a className="text-muted-foreground text-sm font-medium hover:text-primary transition-colors" href="#how">Как это работает</a>
          <a className="text-muted-foreground text-sm font-medium hover:text-primary transition-colors" href="#interface">Интерфейс</a>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to="/" className="hidden sm:flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 bg-muted text-foreground text-sm font-bold hover:bg-accent transition-all">
            Войти
          </Link>
          <Link to="/auth" className="flex min-w-[120px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
            Начать работу
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="px-6 md:px-20 py-12 md:py-24 max-w-[1440px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded-full w-fit">
                  Система №1 для застройщиков
                </span>
                <h1 className="text-foreground text-4xl md:text-6xl font-black leading-tight tracking-tight">
                  Управляйте строительными объектами и документацией в одной системе
                </h1>
                <p className="text-muted-foreground text-lg md:text-xl font-normal leading-relaxed max-w-xl">
                  Единая платформа для автоматизации строительного контроля, документооборота и управления ресурсами. Контролируйте каждый этап с любого устройства.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link to="/auth" className="flex min-w-[180px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 bg-primary text-primary-foreground text-base font-bold hover:translate-y-[-2px] transition-all shadow-xl shadow-primary/30">
                  Попробовать бесплатно
                </Link>
                <Link to="/contact" className="flex min-w-[180px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 border-2 border-border text-foreground text-base font-bold hover:bg-accent transition-all">
                  Записаться на демо
                </Link>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground text-sm">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-background bg-muted" />
                  <div className="w-8 h-8 rounded-full border-2 border-background bg-muted-foreground/30" />
                  <div className="w-8 h-8 rounded-full border-2 border-background bg-muted-foreground/50" />
                </div>
                <span>Доверяют более 500 строительных компаний</span>
              </div>
            </div>

            {/* Dashboard preview */}
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/5 rounded-3xl blur-3xl" />
              <div className="relative bg-card rounded-2xl shadow-2xl border border-border overflow-hidden aspect-video flex items-center justify-center">
                <div className="w-full h-full bg-gradient-to-br from-muted/50 to-muted p-6 flex flex-col gap-4">
                  <div className="flex gap-4">
                    <div className="h-24 flex-1 bg-card rounded-lg shadow-sm p-3">
                      <div className="h-2 w-12 bg-muted rounded mb-2" />
                      <div className="h-4 w-20 bg-primary/20 rounded" />
                    </div>
                    <div className="h-24 flex-1 bg-card rounded-lg shadow-sm p-3">
                      <div className="h-2 w-12 bg-muted rounded mb-2" />
                      <div className="h-4 w-20 bg-green-500/20 rounded" />
                    </div>
                  </div>
                  <div className="flex-1 bg-card rounded-lg shadow-sm p-4">
                    <div className="h-4 w-1/3 bg-muted rounded mb-6" />
                    <div className="space-y-3">
                      <div className="h-2 w-full bg-muted/60 rounded" />
                      <div className="h-2 w-full bg-muted/60 rounded" />
                      <div className="h-2 w-2/3 bg-muted/60 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-6 md:px-20 py-20 bg-card">
          <div className="max-w-[1440px] mx-auto">
            <div className="flex flex-col gap-4 mb-16">
              <h2 className="text-primary text-sm font-bold uppercase tracking-widest">Возможности системы</h2>
              <h3 className="text-foreground text-3xl md:text-4xl font-black max-w-2xl">Все инструменты для стройки в одном окне</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f) => (
                <div key={f.title} className="group flex flex-col gap-6 rounded-2xl border border-border bg-background p-8 hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <f.icon className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col gap-3">
                    <h4 className="text-foreground text-xl font-bold">{f.title}</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="px-6 md:px-20 py-24 bg-background">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-foreground text-3xl md:text-4xl font-black mb-6">Как это работает?</h2>
            <p className="text-muted-foreground text-lg">Запустите систему за 3 простых шага и начните экономить ресурсы уже на этой неделе.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto relative">
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-[2px] bg-border z-0" />
            {steps.map((s) => (
              <div key={s.num} className="relative z-10 flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-lg shadow-primary/20">
                  {s.num}
                </div>
                <div className="flex flex-col gap-2">
                  <h4 className="text-foreground text-lg font-bold">{s.title}</h4>
                  <p className="text-muted-foreground text-sm">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Interface section */}
        <section id="interface" className="px-6 md:px-20 py-24 bg-card overflow-hidden">
          <div className="max-w-[1440px] mx-auto">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              {/* Mock UI */}
              <div className="order-2 lg:order-1 relative">
                <div className="bg-muted rounded-2xl p-4 shadow-inner border border-border">
                  <div className="bg-card rounded-xl shadow-xl overflow-hidden">
                    <div className="h-10 border-b border-border bg-muted flex items-center px-4 gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-center mb-6">
                        <div className="h-6 w-32 bg-muted rounded" />
                        <div className="h-8 w-8 bg-primary rounded-lg" />
                      </div>
                      <div className="space-y-4">
                        <div className="h-12 w-full bg-muted/50 rounded-lg flex items-center px-4">
                          <div className="h-2 w-full bg-primary/20 rounded" />
                        </div>
                        <div className="h-12 w-full bg-muted/50 rounded-lg flex items-center px-4">
                          <div className="h-2 w-3/4 bg-muted-foreground/20 rounded" />
                        </div>
                        <div className="h-12 w-full bg-muted/50 rounded-lg flex items-center px-4">
                          <div className="h-2 w-1/2 bg-muted-foreground/20 rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Float card */}
                <div className="absolute -bottom-10 -right-10 bg-card rounded-xl shadow-2xl p-4 border border-border hidden md:block">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Остатки на складе</span>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-foreground">1,240 т.</div>
                        <div className="text-[10px] text-green-500">+12% к прошлому месяцу</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Text */}
              <div className="order-1 lg:order-2 flex flex-col gap-8">
                <h2 className="text-foreground text-3xl md:text-5xl font-black leading-tight">
                  Профессиональный интерфейс для сложных задач
                </h2>
                <div className="space-y-6">
                  {checkpoints.map((c) => (
                    <div key={c.title} className="flex gap-4">
                      <div className="mt-1 text-primary">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-foreground font-bold text-lg mb-1">{c.title}</h4>
                        <p className="text-muted-foreground text-sm">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 md:px-20 bg-primary overflow-hidden relative py-20 md:py-32">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
          <div className="max-w-4xl mx-auto text-center flex flex-col gap-8 relative z-10">
            <h2 className="text-primary-foreground text-3xl font-black md:text-6xl">
              Готовы навести порядок на своих строительных объектах?
            </h2>
            <p className="text-primary-foreground/80 text-lg md:text-xl max-w-3xl mx-auto">
              CRSS CRM помогает управлять строительными объектами, документацией и материалами в одной системе. AI автоматически распознает спецификации, формирует список материалов и помогает контролировать закупки.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Link to="/auth" className="flex min-w-[220px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 bg-background text-primary text-base font-bold hover:bg-accent transition-all shadow-xl hover:scale-105">
                Начать бесплатно
              </Link>
              <Link to="/contact" className="flex min-w-[220px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 border-2 border-primary-foreground/30 text-primary-foreground text-base font-bold hover:bg-primary-foreground/10 transition-all">
                Запросить демонстрацию
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-20 py-16 bg-card border-t border-border">
        <div className="max-w-[1440px] mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3 text-primary mb-6">
              <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                  <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-foreground text-xl font-bold">CRSS CRM</h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-8">
              Инновационные решения для строительного бизнеса. Автоматизируем процессы, чтобы вы строили быстрее и качественнее.
            </p>
          </div>
          <div>
            <h4 className="text-foreground font-bold mb-6 text-sm uppercase tracking-wider">Продукт</h4>
            <ul className="flex flex-col gap-4 text-sm text-muted-foreground">
              <li><a className="hover:text-primary transition-colors" href="#features">Возможности</a></li>
              <li><Link className="hover:text-primary transition-colors" to="/pricing">Цены</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-foreground font-bold mb-6 text-sm uppercase tracking-wider">Компания</h4>
            <ul className="flex flex-col gap-4 text-sm text-muted-foreground">
              <li><Link className="hover:text-primary transition-colors" to="/about">О нас</Link></li>
              <li><Link className="hover:text-primary transition-colors" to="/contact">Контакты</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-foreground font-bold mb-6 text-sm uppercase tracking-wider">Поддержка</h4>
            <ul className="flex flex-col gap-4 text-sm text-muted-foreground">
              <li><a className="hover:text-primary transition-colors" href="#">Документация</a></li>
              <li><a className="hover:text-primary transition-colors" href="#">База знаний</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-[1440px] mx-auto mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">© 2024 CRSS CRM. Все права защищены.</p>
          <div className="flex gap-8 text-muted-foreground text-sm">
            <a className="hover:text-primary transition-colors" href="#">Политика конфиденциальности</a>
            <a className="hover:text-primary transition-colors" href="#">Условия использования</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
