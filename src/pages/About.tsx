import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Button from "@/components/landing/ui/Button";
import { useNavigate } from "react-router-dom";
import { Workflow, Shield, Users, Zap, Target, Award, CheckCircle } from "lucide-react";

const About = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Workflow className="w-8 h-8" />,
      title: "Технологичность",
      description: "Использование передовых решений для автоматизации и оптимизации бизнес-процессов"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Безопасность данных",
      description: "Гарантируем конфиденциальность данных вашего бизнеса"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Индивидуальные решения",
      description: "Адаптируем систему под потребности вашего бизнеса"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Экспертная поддержка",
      description: "Круглосуточная поддержка от команды экспертов"
    }
  ];

  const timeline = [
    { year: "2018", event: "Основание компании" },
    { year: "2019", event: "Запуск платформы CRSS 1.0" },
    { year: "2021", event: "Стратегическое партнерство" },
    { year: "2023", event: "Выход на международный рынок" }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col">
          <Header />
          
          <main className="flex flex-col gap-24 py-12">
            {/* Hero Section */}
            <section className="text-center animate-fade-in">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                О Corporate Resource Supply System
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Создаем будущее корпоративного снабжения через инновационные технологии
              </p>
            </section>

            {/* Features Grid */}
            <section className="animate-fade-in">
              <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
                Ключевые Преимущества
              </h2>
              <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
                Основные достоинства работы с CRSS, которые обеспечивают эффективность и надежность вашего бизнеса
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="glassmorphism rounded-2xl p-8 border border-border/30 hover:border-primary/50 transition-all duration-300 hover-scale group"
                  >
                    <div className="text-primary mb-4 group-hover:scale-110 transition-transform">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Mission & Values */}
            <section className="grid md:grid-cols-2 gap-6 animate-fade-in">
              <div className="glassmorphism rounded-2xl p-8 border border-border/30">
                <div className="text-primary mb-4">
                  <Target className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Наша Миссия</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Разработка всё более совершенных CRSS — трансформация корпоративного снабжения, обеспечивая бизнесам доступ к инновационным технологическим решениям
                </p>
              </div>
              
              <div className="glassmorphism rounded-2xl p-8 border border-border/30">
                <div className="text-primary mb-4">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Наши Ценности</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Надёжность, Мы верим в укрепите работы нашей платформы — залог устойчивой и продуктивной работы, что позволяет бизнесу расти и преуспевать в современных условиях
                </p>
              </div>
            </section>

            {/* Timeline */}
            <section className="animate-fade-in">
              <h2 className="text-3xl md:text-4xl font-black text-center mb-6">
                История Компании
              </h2>
              <p className="text-center text-muted-foreground mb-12">
                Ключевые вехи нашего развития и роста
              </p>
              
              <div className="space-y-6 max-w-2xl mx-auto">
                {timeline.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 glassmorphism rounded-xl p-6 border border-border/30 hover:border-primary/50 transition-all"
                  >
                    <div className="flex-shrink-0">
                      <CheckCircle className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="text-primary font-bold text-lg">{item.year}</div>
                      <p className="text-muted-foreground">{item.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA Section */}
            <section className="w-full bg-primary rounded-3xl p-8 md:p-12 text-center flex flex-col items-center gap-6 shadow-2xl shadow-primary/20 animate-fade-in">
              <div className="flex flex-col gap-4 max-w-xl">
                <h2 className="text-primary-foreground text-2xl md:text-3xl lg:text-4xl font-black leading-tight">
                  Готовы оптимизировать ваше снабжение?
                </h2>
                <p className="text-primary-foreground/90 text-sm md:text-base lg:text-lg leading-relaxed">
                  Свяжитесь с нами, чтобы узнать больше о возможностях CRSS для вашего бизнеса
                </p>
              </div>
              <Button variant="white" onClick={() => navigate("/contact")}>
                Связаться с нами
              </Button>
            </section>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
};

export default About;
