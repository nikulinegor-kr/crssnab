import { Workflow, BarChart3, Users } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: <Workflow className="w-8 h-8" />,
      title: "Автоматизация процессов",
      description: "Оптимизируйте рабочие процессы и сократите ручной труд благодаря мощным инструментам для автоматизации множества задач"
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Аналитика ресурсов",
      description: "Получайте мгновенные аналитические данные и превращайте их в основанные на данных решения для оптимизации бизнеса"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Управление поставщиками",
      description: "Управляйте отношениями с поставщиками, отслеживайте контракты и оптимизируйте процесс закупок"
    }
  ];

  return (
    <section id="features" className="flex flex-col gap-8 py-6">
      <div className="flex flex-col gap-3 items-center text-center max-w-2xl mx-auto animate-fade-in">
        <h2 className="text-foreground text-3xl md:text-4xl font-black leading-tight">
          Почему выбирают CRSS?
        </h2>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
          CRSS обеспечивает максимальную эффективность, прозрачность и надёжность в управлении поставками и снабжением современного предприятия.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {features.map((feature, index) => (
          <div 
            key={index} 
            className="flex flex-col gap-4 p-6 glassmorphism rounded-xl border border-border/50 hover:border-primary/30 hover:bg-card/50 transition-all items-center animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto">
              {feature.icon}
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
