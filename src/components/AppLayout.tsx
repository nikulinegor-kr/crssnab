import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ReactNode } from "react";
import { SubscriptionBanner } from "./SubscriptionBanner";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-16 flex items-center justify-between border-b border-border/30 bg-gradient-to-r from-card/50 to-card/30 backdrop-blur-xl px-4 sm:px-6 sticky top-0 z-10 shadow-soft">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hover:bg-accent/10 hover:text-accent transition-smooth" />
              <h1 className="text-lg sm:text-xl font-bold text-gradient-accent hidden sm:block">CRSS</h1>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-auto bg-gradient-to-br from-background via-background to-primary/5">
            <div className="w-full p-2 sm:p-4 md:p-6 lg:p-8">
              <SubscriptionBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
