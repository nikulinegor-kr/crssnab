import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Button from "@/components/landing/ui/Button";
import { CheckCircle, Package, TrendingUp, Puzzle, Headphones, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Features = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: CheckCircle,
      title: "Управление заявками",
      description: "Полный контроль над процессом от создания до исполнения."
    },
    {
      icon: Package,
      title: "Отслеживание поставок",
      description: "Отслеживайте вашу логистику и статус поставок в реальном времени."
    },
    {
      icon: TrendingUp,
      title: "Продвинутая аналитика",
      description: "Принимайте верные решения на основе точных данных и отчетов."
    },
    {
      icon: Puzzle,
      title: "Гибкие интеграции",
      description: "Легко интегрируйте CRSS с вашими текущими системами и сервисами."
    },
    {
      icon: Headphones,
      title: "Поддержка 24/7",
      description: "Наша команда экспертов всегда готова прийти на помощь."
    },
    {
      icon: Download,
      title: "Экспорт данных",
      description: "Выгружайте любые отчеты и данные в удобных для вас форматах."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col">
          <Header />
          
          <main className="flex-1 py-12">
            {/* Hero Section */}
            <section className="text-center mb-20">
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                Откройте новые возможности для<br />вашего бизнеса с CRSS
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Оптимизируйте процессы снабжения и управления ресурсами с помощью нашей
                передовой CRM-системы.
              </p>
            </section>

            {/* Features Grid */}
            <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div 
                    key={idx} 
                    className="glassmorphism rounded-2xl p-8 hover:scale-105 transition-transform duration-300"
                  >
                    <div className="mb-6">
                      <Icon className="w-12 h-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </section>

            {/* CTA Section */}
            <section className="text-center glassmorphism rounded-3xl p-12 md:p-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Готовы трансформировать ваше<br />управление поставками?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Оцените мощь CRSS. Начните работу уже сегодня.
              </p>
              <Button onClick={() => navigate("/demo")}>
                Запросить демо-доступ
              </Button>
            </section>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Features;
