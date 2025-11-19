const Footer = () => {
  return (
    <footer className="mt-24 border-t border-border pt-10 pb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="size-5 text-primary">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
              </svg>
            </div>
            <span className="text-foreground text-lg font-bold">CRSS</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Решение для управления корпоративными ресурсами
          </p>
        </div>
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
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Политика конфиденциальности</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Условия использования</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-xs">Cookies</a>
          </div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t border-border/50">
        <p className="text-muted-foreground text-xs">
          © 2025 CRSS, Inc. Все права защищены
        </p>
        <div className="flex gap-4">
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
            <span className="material-symbols-outlined text-lg">language</span>
          </a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
            <span className="material-symbols-outlined text-lg">forum</span>
          </a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
            <span className="material-symbols-outlined text-lg">link</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
