import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border-2 px-3 py-1 text-xs font-semibold tracking-wide transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gradient-accent text-accent-foreground shadow-accent-glow hover:shadow-elevated",
        secondary: "border-transparent bg-secondary text-secondary-foreground shadow-soft hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/80",
        outline: "text-foreground border-border/50 bg-card/30 backdrop-blur-sm shadow-soft hover:bg-card/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
