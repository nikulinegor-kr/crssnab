import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Users, Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: FileText,
      title: "Управление заявками",
      description: "Создавайте, отслеживайте и управляйте всеми заявками в одном месте"
    },
    {
      icon: BarChart3,
      title: "Аналитика и отчёты",
      description: "Получайте детальную статистику по заявкам и исполнителям"
    },
    {
      icon: Users,
      title: "Командная работа",
      description: "Назначайте ответственных и отслеживайте прогресс в реальном времени"
    },
    {
      icon: Shield,
      title: "Безопасность данных",
      description: "Контроль доступа и защита конфиденциальной информации"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header with Login Button */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex justify-end">
          <Button 
            onClick={() => navigate("/auth")}
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
          >
            Войти в систему
          </Button>
        </div>
      </div>
      
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center space-y-6 mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            <span className="text-primary">CRSS</span> — Corporate Resource Supply System
          </h1>
          <p className="text-2xl font-semibold text-foreground mb-4">
            Система Управления Поставками Компании
          </p>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Современная система управления заявками для отдела снабжения. 
            Упростите работу с заявками клиентов и повысьте эффективность команды.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button 
              size="lg" 
              onClick={() => navigate("/dashboard")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
            >
              Перейти к дашборду
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10 font-semibold px-8"
            >
              Узнать больше
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="bg-card p-6 rounded-lg shadow-card hover:shadow-elevated transition-all border border-border"
              >
                <div className="bg-primary/10 text-primary p-3 rounded-lg w-fit mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* Stats Section */}
        <div className="mt-20 bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-8 text-primary-foreground">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold mb-2">500+</p>
              <p className="text-sm opacity-90">Заявок обработано</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">98%</p>
              <p className="text-sm opacity-90">Довольных клиентов</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">24/7</p>
              <p className="text-sm opacity-90">Доступность системы</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
