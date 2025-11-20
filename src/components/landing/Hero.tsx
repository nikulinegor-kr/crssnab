import { useNavigate } from "react-router-dom";
import Button from "./ui/Button";
import heroImage from "@/assets/hero-logistics.png";

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
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
        <Button onClick={() => navigate("/demo?demo=true")}>Запросить демо</Button>
        <Button variant="ghost" onClick={() => navigate("/auth")}>Начать бесплатно</Button>
      </div>
      <div className="w-full max-w-5xl mx-auto mt-12">
        <div className="relative w-full aspect-[16/10] rounded-2xl border border-border shadow-2xl overflow-hidden">
          <img 
            src={heroImage} 
            alt="Глобальная логистическая сеть с воздушным, наземным транспортом и аналитикой" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;
