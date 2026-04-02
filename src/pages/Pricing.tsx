import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { CheckCircle, Zap, Building2, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

interface PlanSection {
  title: string;
  items: string[];
}

interface Plan {
  name: string;
  price: string;
  description: string;
  icon: React.ReactNode;
  popular?: boolean;
  sections: PlanSection[];
}

const plans: Plan[] = [
  {
    name: "Стартовый",
    price: "1 490",
    description: "Для небольших команд и старта работы с заявками",
    icon: <Rocket className="h-5 w-5" />,
    sections: [
      {
        title: "Лимиты",
        items: [
          "До 3 пользователей",
          "До 50 заявок в месяц",
          "1 склад / объект",
        ],
      },
      {
        title: "Возможности",
        items: [
          "Управление заявками",
          "Приоритеты (Аварийно / Планово)",
          "Статусы заявок",
          "Базовая таблица и фильтры",
          "Привязка к технике",
          "История изменений",
        ],
      },
      {
        title: "Интеграции",
        items: ["Экспорт в Excel"],
      },
      {
        title: "Поддержка",
        items: ["Email поддержка"],
      },
    ],
  },
  {
    name: "Профессиональный",
    price: "3 990",
    description: "Для команд, которые активно работают с закупками и логистикой",
    icon: <Zap className="h-5 w-5" />,
    popular: true,
    sections: [
      {
        title: "Лимиты",
        items: [
          "До 5 пользователей",
          "До 100 заявок в месяц",
          "До 3 складов / объектов",
        ],
      },
      {
        title: "Возможности",
        items: [
          "Всё из тарифа «Стартовый»",
          "Контрагенты (поставщики)",
          "Счета и отслеживание оплат",
          "Приходы и контроль поставок",
          "Транспортные компании (ТК)",
          "Комментарии к заявкам",
          "Быстрый просмотр заявки",
          "Расширенные фильтры и поиск",
        ],
      },
      {
        title: "Автоматизация",
        items: [
          "Уведомления (Telegram / Email)",
          "Обновление статусов в реальном времени",
        ],
      },
      {
        title: "Интеграции",
        items: ["Экспорт в Excel и PDF"],
      },
      {
        title: "Поддержка",
        items: ["Приоритетная поддержка"],
      },
    ],
  },
  {
    name: "Корпоративный",
    price: "7 990",
    description: "Для компаний с большим потоком заявок и несколькими отделами",
    icon: <Building2 className="h-5 w-5" />,
    sections: [
      {
        title: "Лимиты",
        items: [
          "Неограниченное кол-во пользователей",
          "Неограниченное кол-во заявок",
          "Неограниченное кол-во объектов",
        ],
      },
      {
        title: "Возможности",
        items: [
          "Всё из тарифа «Профессиональный»",
          "Роли и права доступа (RBAC)",
          "Разделение по отделам",
          "Общая база поставщиков",
          "Расширенная аналитика (отчёты)",
          "История действий пользователей",
          "Массовые операции (bulk actions)",
        ],
      },
      {
        title: "Автоматизация",
        items: [
          "Автологика по статусам (workflow)",
          "Напоминания и дедлайны",
          "AI-ассистент",
        ],
      },
      {
        title: "Интеграции",
        items: ["API доступ", "Webhooks"],
      },
      {
        title: "Поддержка",
        items: ["Персональный менеджер", "Помощь с внедрением"],
      },
    ],
  },
];

export default function Pricing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col">
          <Header />

          <main className="flex-1 py-12">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-semibold mb-4 tracking-tight">
                Тарифы
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Выберите план под размер вашей команды. Все тарифы включают 7 дней бесплатного пробного периода.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl border bg-card p-6 flex flex-col ${
                    plan.popular
                      ? "border-primary shadow-lg ring-1 ring-primary/20"
                      : "border-border"
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3">
                      Популярный
                    </Badge>
                  )}

                  <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                    {plan.icon}
                    <span className="text-sm font-medium uppercase tracking-wide">
                      {plan.name}
                    </span>
                  </div>

                  <div className="mb-2">
                    <span className="text-4xl font-semibold tracking-tight">{plan.price}₽</span>
                    <span className="text-muted-foreground text-sm ml-1">/ мес</span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                    {plan.description}
                  </p>

                  <Button
                    className="w-full mb-5"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => navigate("/auth")}
                  >
                    Попробовать бесплатно
                  </Button>

                  <div className="flex-1 space-y-4">
                    {plan.sections.map((section, si) => (
                      <div key={si}>
                        <Separator className="mb-3" />
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                          {section.title}
                        </p>
                        <ul className="space-y-1.5">
                          {section.items.map((item, ii) => (
                            <li key={ii} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
}
