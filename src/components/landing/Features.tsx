const Features = () => {
  const features = [
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
  ];

  return (
    <section id="features" className="flex flex-col gap-12 py-12">
      <div className="flex flex-col gap-3 text-center max-w-2xl mx-auto animate-fade-in">
        <h2 className="text-foreground text-3xl md:text-4xl font-black leading-tight">
          Почему выбирают CRSS?
        </h2>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
          Определите для себя непревзойдённую эффективность, контроль и надёжность с нашей передовой CRM-системой, разработанной для современного предприятия
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {features.map((feature, index) => (
          <div 
            key={index} 
            className="flex flex-col gap-4 p-6 glassmorphism rounded-xl border border-border/50 hover:border-primary/30 transition-all text-center items-center animate-fade-in hover-scale"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
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
  );
};

export default Features;
