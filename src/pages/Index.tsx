import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col">
          <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-white/10 px-6 py-4 glassmorphism rounded-lg mb-16">
            <div className="flex items-center gap-4">
              <div className="size-6 text-primary">
                <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-white text-xl font-bold leading-tight tracking-[-0.015em]">CRSS</h2>
            </div>
            <div className="hidden md:flex flex-1 justify-end gap-8">
              <div className="flex items-center gap-9">
                <a className="text-white/80 hover:text-white transition-colors text-sm font-medium leading-normal" href="#features">Возможности</a>
                <a className="text-white/80 hover:text-white transition-colors text-sm font-medium leading-normal" href="#pricing">Цены</a>
                <a className="text-white/80 hover:text-white transition-colors text-sm font-medium leading-normal" href="#about">О нас</a>
                <a className="text-white/80 hover:text-white transition-colors text-sm font-medium leading-normal" href="#contact">Контакты</a>
              </div>
              <Button onClick={() => navigate("/auth")} className="min-w-[84px] h-10 px-4">
                <span className="truncate">Войти</span>
              </Button>
            </div>
            <div className="md:hidden">
              <Button onClick={() => navigate("/auth")} size="sm">Войти</Button>
            </div>
          </header>

          <main className="flex flex-col gap-20 md:gap-24 lg:gap-32">
            <section className="flex flex-col gap-6 text-center items-center py-10">
              <div className="flex flex-col gap-4">
                <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em] md:text-5xl lg:text-6xl max-w-4xl">
                  Оптимизируйте цепочку поставок корпоративных ресурсов
                </h1>
                <h2 className="text-white/70 text-base font-normal leading-normal md:text-lg max-w-2xl mx-auto">
                  CRSS предоставляет мощную интегрированную платформу для управления ресурсами, автоматизации процессов и получения критически важных данных для максимальной эффективности.
                </h2>
              </div>
              <div className="flex flex-wrap gap-4 justify-center mt-6">
                <Button onClick={() => navigate("/demo?demo=true")} className="h-12 px-6 text-base font-bold">
                  <span className="truncate">Запросить демо</span>
                </Button>
                <Button onClick={() => navigate("/auth")} className="h-12 px-6 bg-white/10 text-white text-base font-bold hover:bg-white/20">
                  <span className="truncate">Начать бесплатно</span>
                </Button>
              </div>
              <div className="w-full mt-12">
                <div className="relative w-full aspect-video bg-cover bg-center rounded-xl border border-white/10 shadow-2xl shadow-primary/10" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAzdGsFO9UE4B1kiiR2MnJWGHPuHcEy2eHIeAYiTfCPBw0ossJrmFcj6wcg4JHIk8vqghtnHocaFC6UE6JB2vceWrZ73ukEahm4PCigipdxj1T11pAehC8xgir_ypNjymU8rUHvx-f_GxLNDerRASkJvgCUEq6Agv22F4vaYPigbIvaNeIsD3T2xe3y2nESp-0f-zrPI5zVIaeKI-zv2BORAOtfz0L3AyDefiE3sb9EpMld2BNnJEld8fNLYy8sFskpVecYNza-esM")'}}>
                  <div className="absolute inset-0 bg-black/30 rounded-xl"></div>
                </div>
              </div>
            </section>

            <section id="features" className="flex flex-col gap-10">
              <div className="flex flex-col gap-3 text-center items-center">
                <h2 className="text-white tracking-tight text-3xl font-bold leading-tight md:text-4xl">Почему выбирают CRSS?</h2>
                <p className="text-white/70 text-base font-normal leading-normal max-w-2xl">Откройте для себя непревзойденную эффективность, контроль и аналитику с нашей передовой CRM-системой, разработанной для современных предприятий.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="flex flex-col gap-4 p-6 rounded-xl glassmorphism">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-3xl">model_training</span>
                  </div>
                  <div>
                    <p className="text-white text-lg font-bold leading-normal">Автоматизация процессов</p>
                    <p className="text-white/60 text-sm font-normal leading-normal mt-1">Оптимизируйте рабочие процессы и сократите ручные задачи с помощью интеллектуальной автоматизации.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 p-6 rounded-xl glassmorphism">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-3xl">analytics</span>
                  </div>
                  <div>
                    <p className="text-white text-lg font-bold leading-normal">Аналитика ресурсов</p>
                    <p className="text-white/60 text-sm font-normal leading-normal mt-1">Принимайте решения на основе данных с помощью комплексной аналитики в реальном времени.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 p-6 rounded-xl glassmorphism">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-3xl">groups</span>
                  </div>
                  <div>
                    <p className="text-white text-lg font-bold leading-normal">Управление поставщиками</p>
                    <p className="text-white/60 text-sm font-normal leading-normal mt-1">Эффективно управляйте и взаимодействуйте со всеми вашими поставщиками в одном месте.</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex flex-col gap-4 text-center items-center">
                <h2 className="text-white text-3xl font-bold leading-tight tracking-[-0.015em]">Посмотрите в действии</h2>
              </div>
              <div className="mt-8">
                <div className="relative flex items-center justify-center bg-cover bg-center aspect-video rounded-xl p-4 border border-white/10" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC-mGnz1NP2hfTyjXj9AGMwht060z5MOZ8KjZGOrOz_r9AUXnnnBvnRqDMmilRGM0ZYGUtzKKzax7qCUAoMy3rFlH7XayP6zpJpMBFNrGlOLgqb08wLfNHAsFcIvJ9PYWLCMjpBgr-lI0mZEhPKu6KNCprwPRpLdaDvAzKsG_EFQWUGZZAeOrFBU9ElTQslbikqPMKksrTUXhU3Q-eR5ITq9P2WmedKDkcMT1Dj5mPD5pus1gdiryWJUsFZwkBcA73zx6BbyOKWkA0")'}}>
                  <div className="absolute inset-0 bg-black/50 rounded-xl"></div>
                  <button onClick={() => navigate("/demo?demo=true")} className="relative flex shrink-0 items-center justify-center rounded-full size-20 bg-primary/80 text-white backdrop-blur-sm hover:bg-primary transition-colors">
                    <span className="material-symbols-outlined text-4xl">play_arrow</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="flex flex-col items-center gap-8">
              <h3 className="text-lg font-semibold text-white/80">Нам доверяют лидеры отрасли</h3>
              <div className="w-full flex justify-center items-center gap-10 sm:gap-16 flex-wrap opacity-40 grayscale">
                <div className="h-8"><svg className="h-full w-auto text-white fill-current" viewBox="0 0 128 35"><path d="M127.42 21.03c0-1.46-.1-2.92-.31-4.38h-58.8v10.99h33.61c-1.47 7.02-8.5 12.2-20.73 12.2-12.42 0-22.51-10.23-22.51-22.84s10.09-22.84 22.51-22.84c6.98 0 11.83 2.97 14.57 5.59l-8.62 8.35c-2.6-2.5-6.1-5.1-14.57-5.1-10.02 0-18.14 8.2-18.14 18.39s8.12 18.39 18.14 18.39c11.59 0 16.59-8.79 17.2-13.43h-25.82v-11h58.8c.55 3.1.86 6.3.86 9.68 0 21.32-14.2 36.36-36.5 36.36s-36.5-16.36-36.5-36.36S34.02 0 46.32 0s36.5 16.36 36.5 36.36c0 5.46-1.12 10.72-3.21 15.38l-8.6-8.34c1.1-2.9 1.7-6 1.7-9.21z"></path></svg></div>
                <div className="h-8"><svg className="h-full w-auto text-white fill-current" viewBox="0 0 128 35"><path d="M64 35C28.65 35 0 27.16 0 17.5S28.65 0 64 0s64 7.84 64 17.5-28.65 17.5-64 17.5zM36.1 17.5c0 7.1 12.44 12.83 27.9 12.83S91.9 24.6 91.9 17.5 79.46 4.67 64 4.67 36.1 10.4 36.1 17.5z"></path></svg></div>
                <div className="h-8"><svg className="h-full w-auto text-white fill-current" viewBox="0 0 128 35"><path d="M26.24 34.39V0h11.88v34.39H26.24zM89.88 34.39V0h11.88v34.39H89.88zM64 35C28.65 35 0 27.16 0 17.5S28.65 0 64 0s64 7.84 64 17.5-28.65 17.5-64 17.5z"></path></svg></div>
                <div className="h-8"><svg className="h-full w-auto text-white fill-current" viewBox="0 0 128 35"><path d="M128 17.5C128 7.84 99.35 0 64 0S0 7.84 0 17.5 28.65 35 64 35s64-7.84 64-17.5zm-14.88 0c0-6.13-22.04-11.1-49.12-11.1S14.88 11.37 14.88 17.5c0 6.13 22.04 11.1 49.12 11.1S113.12 23.63 113.12 17.5z"></path></svg></div>
              </div>
            </section>

            <section className="w-full bg-primary/90 rounded-xl p-8 md:p-12 text-center flex flex-col items-center gap-6">
              <h2 className="text-white text-3xl md:text-4xl font-bold max-w-2xl">Трансформируйте управление поставками уже сегодня</h2>
              <p className="text-white/80 max-w-xl">Готовы взять все под контроль? Начните работу с CRSS и раскройте весь потенциал ваших корпоративных ресурсов.</p>
              <div className="flex flex-wrap gap-4 justify-center mt-2">
                <Button onClick={() => navigate("/demo?demo=true")} className="h-12 px-6 bg-white text-primary text-base font-bold hover:bg-white/90">
                  <span className="truncate">Запросить демо</span>
                </Button>
                <Button onClick={() => navigate("/auth")} className="h-12 px-6 bg-transparent border-2 border-white text-white text-base font-bold hover:bg-white/10">
                  <span className="truncate">Начать бесплатно</span>
                </Button>
              </div>
            </section>
          </main>

          <footer className="mt-20 md:mt-24 lg:mt-32 border-t border-white/10 pt-10 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-1">
                <div className="flex items-center gap-3">
                  <div className="size-6 text-primary"><svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" /></svg></div>
                  <h2 className="text-white text-xl font-bold">CRSS</h2>
                </div>
                <p className="text-white/60 text-sm mt-4">Будущее управления корпоративными ресурсами.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:col-span-3 gap-8">
                <div>
                  <h4 className="font-semibold text-white">Продукт</h4>
                  <ul className="mt-4 space-y-3">
                    <li><a className="text-white/60 hover:text-white text-sm" href="#features">Возможности</a></li>
                    <li><a className="text-white/60 hover:text-white text-sm" href="#pricing">Цены</a></li>
                    <li><a className="text-white/60 hover:text-white text-sm" href="#integration">Интеграции</a></li>
                    <li><button onClick={() => navigate("/demo?demo=true")} className="text-white/60 hover:text-white text-sm text-left">Демо</button></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Компания</h4>
                  <ul className="mt-4 space-y-3">
                    <li><a className="text-white/60 hover:text-white text-sm" href="#about">О нас</a></li>
                    <li><a className="text-white/60 hover:text-white text-sm" href="#career">Карьера</a></li>
                    <li><a className="text-white/60 hover:text-white text-sm" href="#blog">Блог</a></li>
                    <li><a className="text-white/60 hover:text-white text-sm" href="#contact">Связаться с нами</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Правовая информация</h4>
                  <ul className="mt-4 space-y-3">
                    <li><a className="text-white/60 hover:text-white text-sm" href="#privacy">Политика конфиденциальности</a></li>
                    <li><a className="text-white/60 hover:text-white text-sm" href="#terms">Условия обслуживания</a></li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-white/50 text-sm">© 2024 crssnab.ru. Все права защищены.</p>
              <div className="flex gap-4">
                <a className="text-white/60 hover:text-white transition-colors" href="#"><svg className="size-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.46,6C21.69,6.35 20.86,6.58 20,6.69C20.88,6.16 21.56,5.32 21.88,4.31C21.05,4.81 20.13,5.16 19.16,5.36C18.37,4.5 17.26,4 16,4C13.65,4 11.73,5.92 11.73,8.29C11.73,8.63 11.77,8.96 11.84,9.27C8.28,9.09 5.11,7.38 3,4.79C2.63,5.42 2.42,6.16 2.42,6.94C2.42,8.43 3.17,9.75 4.33,10.5C3.62,10.5 2.96,10.3 2.38,10C2.38,10 2.38,10 2.38,10.03C2.38,12.11 3.86,13.85 5.82,14.24C5.46,14.34 5.08,14.39 4.69,14.39C4.42,14.39 4.15,14.36 3.89,14.31C4.43,16.03 6.02,17.26 7.89,17.29C6.43,18.45 4.58,19.13 2.56,19.13C2.22,19.13 1.88,19.11 1.54,19.07C3.44,20.29 5.7,21 8.12,21C16,21 20.33,14.46 20.33,8.79C20.33,8.6 20.33,8.42 20.32,8.23C21.16,7.63 21.88,6.87 22.46,6Z"></path></svg></a>
                <a className="text-white/60 hover:text-white transition-colors" href="#"><svg className="size-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.11 3.9,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.1,3 19,3M18.5,18.5H16.5V13.2A1.26,1.26 0 0,0 15.24,12A1.26,1.26 0 0,0 14,13.2V18.5H12V9.5H14V10.9C14.33,10.17 15.33,9.25 16.92,9.25C18.5,9.25 18.5,10.83 18.5,12.5V18.5M7,8.5A1.5,1.5 0 1,1 8.5,7A1.5,1.5 0 0,1 7,8.5M9,18.5H5V9.5H9V18.5Z"></path></svg></a>
                <a className="text-white/60 hover:text-white transition-colors" href="#"><svg className="size-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"></path></svg></a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Index;
