import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'white';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  children, 
  ...props 
}) => {
  const baseStyles = "flex cursor-pointer items-center justify-center overflow-hidden rounded-lg px-6 font-bold leading-normal tracking-[0.015em] transition-all duration-200 hover-scale";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary/90 h-10 md:h-12 text-sm md:text-base shadow-lg shadow-primary/20",
    outline: "bg-transparent border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 h-10 md:h-12 text-sm md:text-base",
    ghost: "bg-secondary text-foreground hover:bg-secondary/80 h-10 md:h-12 text-sm md:text-base",
    white: "bg-background text-foreground hover:bg-background/90 h-10 md:h-12 text-sm md:text-base shadow-lg",
  };

  const widthClass = fullWidth ? "w-full" : "min-w-[120px] max-w-[480px]";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`} 
      {...props}
    >
      <span className="truncate">{children}</span>
    </button>
  );
};

export default Button;
