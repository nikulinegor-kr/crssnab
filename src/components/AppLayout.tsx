import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ReactNode } from "react";
import { SubscriptionBanner } from "./SubscriptionBanner";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-background/95">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border/40 glassmorphism px-4 sticky top-0 z-10">
            <SidebarTrigger className="hover:bg-white/10 transition-colors rounded-md" />
          </header>

          <main className="flex-1 overflow-auto">
            <div className="w-full p-2 sm:p-3 md:p-6">
              <SubscriptionBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
