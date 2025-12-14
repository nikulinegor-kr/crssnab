import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

export const SettingsSection = ({ 
  title, 
  description, 
  icon: Icon,
  children,
  className 
}: SettingsSectionProps) => {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3 pb-2 border-b">
        {Icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="animate-fade-in">
        {children}
      </div>
    </div>
  );
};
