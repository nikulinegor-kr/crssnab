import { ReactNode, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSectionCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  titleClassName?: string;
}

export const FormSectionCard = ({
  title,
  icon,
  children,
  collapsible = false,
  defaultCollapsed = false,
  className,
  titleClassName,
}: FormSectionCardProps) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <Card className={cn("border-border/40 bg-card/50 overflow-hidden", className)}>
      <CardHeader 
        className={cn(
          "pb-2 sm:pb-3 pt-3.5 sm:pt-5 px-3.5 sm:px-5",
          collapsible && "cursor-pointer select-none hover:bg-muted/30 transition-colors"
        )}
        onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
      >
        <div className="flex items-center justify-between">
          <CardTitle className={cn("text-sm font-semibold flex items-center gap-2 text-foreground", titleClassName)}>
            {icon}
            {title}
          </CardTitle>
          {collapsible && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
              }}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="px-3.5 sm:px-5 pb-3.5 sm:pb-5 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
};
