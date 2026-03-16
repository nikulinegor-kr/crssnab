import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Button from "./ui/Button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const isHomePage = location.pathname === "/";
  
  const navLinks = [
    { name: 'Возможности', href: isHomePage ? '#features' : '/features' },
    { name: 'FAQ', href: isHomePage ? '#faq' : '/#faq' },
    { name: 'Цены', href: '/pricing' },
    { name: 'О нас', href: '/about' },
    { name: 'Контакты', href: '/contact' }
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      setIsOpen(false);
    } else if (href.startsWith('/#')) {
      e.preventDefault();
      navigate('/');
      setTimeout(() => {
        const element = document.querySelector(href.substring(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      setIsOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-border/30 px-4 md:px-6 py-3 glassmorphism rounded-xl mb-12">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
        <img src="/logo.png" alt="CRSS" className="h-5 w-5 object-contain" />
        <h2 className="text-foreground text-lg font-bold leading-tight">CRSS</h2>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:flex flex-1 items-center justify-center">
        <nav className="flex items-center gap-7">
          {navLinks.map(link => (
            <a 
              key={link.name} 
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              {link.name}
            </a>
          ))}
        </nav>
      </div>
      <Button onClick={() => navigate("/auth")} className="hidden md:inline-flex !h-9 text-center mx-0 my-0 px-0 py-0 text-xs">
        Войти
      </Button>

      {/* Mobile Menu */}
      <div className="md:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className="p-2 text-foreground hover:text-primary transition-colors">
              <Menu className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] bg-background border-border">
            <nav className="flex flex-col gap-4 mt-8">
              {navLinks.map(link => (
                <a 
                  key={link.name} 
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="text-foreground hover:text-primary transition-colors text-lg font-medium py-2 border-b border-border/30"
                >
                  {link.name}
                </a>
              ))}
              <Button 
                onClick={() => {
                  navigate("/auth");
                  setIsOpen(false);
                }} 
                className="mt-4 w-full"
              >
                Войти
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Header;