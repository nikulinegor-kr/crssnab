import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQSection = () => {
  const faqs = [
    {
      question: "Что такое CRSS и для кого он предназначен?",
      answer: "CRSS — это платформа автоматизации корпоративного снабжения, разработанная для компаний любого размера. Она помогает оптимизировать процессы закупок, управлять поставщиками и отслеживать заявки в режиме реального времени."
    },
    {
      question: "Сколько времени занимает внедрение системы?",
      answer: "Базовое внедрение занимает от 1 до 3 дней. Мы предоставляем полную поддержку на всех этапах: от настройки до обучения сотрудников. Для крупных предприятий возможна индивидуальная программа внедрения."
    },
    {
      question: "Можно ли интегрировать CRSS с другими системами?",
      answer: "Да, CRSS поддерживает интеграцию с популярными ERP-системами, 1С, Telegram-ботами и другими сервисами через API. Мы также можем разработать кастомные интеграции под ваши нужды."
    },
    {
      question: "Какие способы оплаты вы принимаете?",
      answer: "Мы принимаем оплату банковскими картами, безналичный расчёт для юридических лиц, а также работаем по договору с постоплатой для корпоративных клиентов."
    },
    {
      question: "Есть ли бесплатный пробный период?",
      answer: "Да, мы предоставляем 14 дней бесплатного доступа ко всем функциям платформы. Кредитная карта не требуется. Вы также можете запросить персональную демонстрацию системы."
    },
    {
      question: "Как обеспечивается безопасность данных?",
      answer: "Мы используем шифрование данных, регулярное резервное копирование и размещаем серверы в сертифицированных дата-центрах. Все данные принадлежат только вам и никогда не передаются третьим лицам."
    }
  ];

  return (
    <section id="faq" className="py-12 md:py-16">
      <div className="flex flex-col gap-8 max-w-3xl mx-auto">
        <div className="text-center space-y-3">
          <h2 className="text-foreground text-3xl md:text-4xl font-black leading-tight">
            Частые вопросы
          </h2>
          <p className="text-muted-foreground text-sm md:text-base">
            Ответы на популярные вопросы о платформе CRSS
          </p>
        </div>
        
        <Accordion type="single" collapsible className="w-full space-y-3">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="border border-border/50 rounded-xl px-6 bg-card/30 backdrop-blur-sm data-[state=open]:bg-card/50 transition-colors"
            >
              <AccordionTrigger className="text-left text-foreground font-semibold hover:no-underline py-5">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
