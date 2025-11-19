import { useNavigate } from "react-router-dom";
import Button from "./ui/Button";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="w-full bg-primary rounded-3xl p-8 md:p-12 text-center flex flex-col items-center gap-6 shadow-2xl shadow-primary/20 animate-fade-in">
      <div className="flex flex-col gap-4 max-w-xl">
        <h2 className="text-primary-foreground text-2xl md:text-3xl lg:text-4xl font-black leading-tight">
          Трансформируйте управление поставками уже сегодня
        </h2>
        <p className="text-primary-foreground/90 text-sm md:text-base lg:text-lg leading-relaxed">
          Готовы вывести свой бизнес на новый уровень? Начните работу с CRSS и открывайте для себя безграничные возможности оптимизации и контроля
        </p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center mt-2 w-full sm:w-auto">
        <Button variant="white" onClick={() => navigate("/demo?demo=true")}>
          Запросить демо
        </Button>
        <Button variant="outline" onClick={() => navigate("/auth")}>
          Начать бесплатно
        </Button>
      </div>
    </section>
  );
};

export default CTASection;
