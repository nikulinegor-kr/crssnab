import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-border/30 px-4 md:px-6 py-3 glassmorphism rounded-xl mb-12">
      <div className="flex items-center gap-3">
        <div className="size-5 text-primary">
          <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-foreground text-lg font-bold leading-tight">CRSS</h2>
      </div>
      <div className="hidden md:flex flex-1 justify-end gap-6">
        <nav className="flex items-center gap-7">
          <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium" href="#features">Возможности</a>
          <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium" href="#pricing">Цены</a>
          <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium" href="#about">О нас</a>
          <a className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium" href="#contact">Контакты</a>
        </nav>
        <Button onClick={() => navigate("/auth")} className="h-9 px-5 text-sm font-medium rounded-lg">
          Войти
        </Button>
      </div>
      <div className="md:hidden">
        <Button onClick={() => navigate("/auth")} size="sm" className="h-9 px-4 text-xs">Войти</Button>
      </div>
    </header>
  );
};

export default Header;
