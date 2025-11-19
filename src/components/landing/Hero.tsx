import { useNavigate } from "react-router-dom";
import Button from "./ui/Button";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-6 text-center items-center py-12 animate-fade-in">
      <div className="flex flex-col gap-5 max-w-3xl mx-auto">
        <h1 className="text-foreground text-[2.5rem] md:text-5xl lg:text-[3.5rem] font-black leading-[1.1] tracking-tight">
          Оптимизируйте цепочку поставок корпоративных ресурсов
        </h1>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-xl mx-auto px-4">
          CRSS предоставляет мощную интегрированную платформу для управления ресурсами, автоматизации процессов и получения критически важных данных для максимальной эффективности.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center mt-6">
        <Button onClick={() => navigate("/demo?demo=true")}>Запросить демо</Button>
        <Button variant="ghost" onClick={() => navigate("/auth")}>Начать бесплатно</Button>
      </div>
      <div className="w-full max-w-5xl mx-auto mt-12">
        <div className="relative w-full aspect-[16/10] glassmorphism rounded-2xl border border-border shadow-2xl overflow-hidden group cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent group-hover:from-primary/15 transition-all duration-300"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-primary/90 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform group-hover:bg-primary">
              <span className="material-symbols-outlined text-primary-foreground text-4xl">play_arrow</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
