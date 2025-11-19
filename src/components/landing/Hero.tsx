import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-8 text-center items-center py-12 animate-fade-in">
      <div className="flex flex-col gap-5 max-w-3xl mx-auto">
        <h1 className="text-foreground text-[2.5rem] md:text-5xl lg:text-[3.5rem] font-black leading-[1.1] tracking-tight">
          Оптимизируйте цепочку поставок корпоративных ресурсов
        </h1>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-xl mx-auto px-4">
          CRSS предоставляет мощную интегрированную платформу для управления ресурсами, автоматизации процессов и получения критически важных данных для максимальной эффективности.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <Button onClick={() => navigate("/demo?demo=true")} className="h-11 px-7 text-sm font-bold rounded-lg hover-scale">
          Запросить демо
        </Button>
        <Button onClick={() => navigate("/auth")} variant="secondary" className="h-11 px-7 text-sm font-bold rounded-lg hover-scale">
          Начать бесплатно
        </Button>
      </div>
      <div className="w-full max-w-5xl mx-auto mt-10">
        <div className="relative w-full aspect-[16/10] glassmorphism rounded-2xl border border-border shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-primary/90 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer">
              <span className="material-symbols-outlined text-primary-foreground text-4xl">play_arrow</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
