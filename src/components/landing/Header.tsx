import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "./ui/Button";

const Header = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Возможности', href: '#features' },
    { name: 'Цены', href: '#pricing' },
    { name: 'О нас', href: '#about' },
    { name: 'Контакты', href: '#contact' },
  ];

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-border/30 px-4 md:px-6 py-3 glassmorphism rounded-xl mb-12">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
        <div className="size-5 text-primary">
          <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-foreground text-lg font-bold leading-tight">CRSS</h2>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:flex flex-1 justify-end gap-6">
        <nav className="flex items-center gap-7">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href} 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              {link.name}
            </a>
          ))}
        </nav>
        <Button className="!h-9 !text-sm" onClick={() => navigate("/auth")}>Войти</Button>
      </div>

      {/* Mobile Menu Toggle */}
      <div className="md:hidden">
        <Button className="!h-9 !px-4 !text-xs" onClick={() => navigate("/auth")}>Войти</Button>
      </div>
    </header>
  );
};

export default Header;
