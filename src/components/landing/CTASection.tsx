import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-6 text-center items-center py-16 px-8 md:px-12 bg-primary rounded-3xl shadow-2xl animate-fade-in">
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
          className="h-11 px-7 text-sm font-bold bg-background text-foreground hover:bg-background/90 rounded-lg hover-scale"
        >
          Запросить демо
        </Button>
        <Button 
          onClick={() => navigate("/auth")} 
          variant="outline"
          className="h-11 px-7 text-sm font-bold border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 rounded-lg hover-scale"
        >
          Начать бесплатно
        </Button>
      </div>
    </section>
  );
};

export default CTASection;
