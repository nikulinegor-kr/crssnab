

const Footer = () => {
  return (
    <footer className="mt-24 border-t border-border pt-10 pb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
        {/* Brand Column */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="CRSS" className="h-5 w-5 object-contain" />
            <span className="text-foreground text-lg font-bold">CRSS</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed mt-3">
            Будущее управления корпоративными ресурсами
          </p>
        </div>

        {/* Links Columns */}
        <div className="grid grid-cols-3 md:col-span-3 gap-6 md:gap-8">
          <div className="flex flex-col gap-3">
            <h3 className="text-foreground font-bold text-xs uppercase tracking-wide">Продукт</h3>
            <div className="flex flex-col gap-2">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Возможности</a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Цены</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Интеграции</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Демо</a>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-foreground font-bold text-xs uppercase tracking-wide">Компания</h3>
            <div className="flex flex-col gap-2">
              <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors text-xs">О нас</a>
              <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Контакты</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Карьера</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Блог</a>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-foreground font-bold text-xs uppercase tracking-wide">Правовая информация</h3>
            <div className="flex flex-col gap-2">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Конфиденциальность</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Условия</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Cookies</a>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center items-center pt-6 border-t border-border/50">
        <p className="text-muted-foreground text-xs">
          © 2025 CRSS, Inc. Все права защищены
        </p>
      </div>
    </footer>
  );
};

export default Footer;
