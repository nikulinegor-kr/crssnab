import { useNavigate } from "react-router-dom";
import Button from "./ui/Button";
import heroVideo from "@/assets/hero-video.mp4";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-4 md:gap-6 text-center items-center py-6 md:py-12 animate-fade-in px-4">
      <div className="flex flex-col gap-3 md:gap-5 max-w-3xl mx-auto w-full">
        <h1 className="text-foreground text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
          CRSS: Оптимизируйте систему корпоративного снабжения!
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm md:text-base leading-relaxed max-w-xl mx-auto">
          CRSS — единая платформа автоматизации и аналитики, которая делает поставки быстрее, прозрачнее и эффективнее.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-2 md:mt-6 w-full sm:w-auto">
        <Button onClick={() => navigate("/demo?demo=true")} className="w-full sm:w-auto">Запросить демо</Button>
        <Button variant="ghost" onClick={() => navigate("/auth")} className="w-full sm:w-auto">Начать бесплатно</Button>
      </div>
      <div className="w-full max-w-5xl mx-auto mt-6 md:mt-12">
        <div className="relative w-full aspect-video md:aspect-[16/10] rounded-lg md:rounded-2xl border border-border shadow-2xl overflow-hidden">
          <video 
            src={heroVideo} 
            autoPlay 
            loop
            muted 
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;
