import { Suspense, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { NetworkStatusIndicator } from "./components/NetworkStatusIndicator";

// Lazy load all pages with retry mechanism for code splitting
const Index = lazyWithRetry(() => import("./pages/Index"));
const Landing = lazyWithRetry(() => import("./pages/Landing"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const ImportData = lazyWithRetry(() => import("./pages/ImportData"));
const Requests = lazyWithRetry(() => import("./pages/Requests"));
const RequestDetail = lazyWithRetry(() => import("./pages/RequestDetail"));
const Suppliers = lazyWithRetry(() => import("./pages/Suppliers"));
const CalendarPage = lazyWithRetry(() => import("./pages/CalendarPage"));
const TasksPage = lazyWithRetry(() => import("./pages/TasksPage"));
const ChatPage = lazyWithRetry(() => import("./pages/ChatPage"));
const ProfilePage = lazyWithRetry(() => import("./pages/ProfilePage"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const SelectOrganization = lazyWithRetry(() => import("./pages/SelectOrganization"));
const OrganizationSettings = lazyWithRetry(() => import("./pages/OrganizationSettings"));
const AgentReport = lazyWithRetry(() => import("./pages/AgentReport"));
const AgentActReport = lazyWithRetry(() => import("./pages/AgentActReport"));
const PercentCalculator = lazyWithRetry(() => import("./pages/PercentCalculator"));

const AIAnalytics = lazyWithRetry(() => import("./pages/AIAnalytics"));
const AIAssistant = lazyWithRetry(() => import("./pages/AIAssistant"));
const SpareParts = lazyWithRetry(() => import("./pages/SpareParts"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const Features = lazyWithRetry(() => import("./pages/Features"));
const Demo = lazyWithRetry(() => import("./pages/Demo"));
const About = lazyWithRetry(() => import("./pages/About"));
const Contact = lazyWithRetry(() => import("./pages/Contact"));
const SystemDemo = lazyWithRetry(() => import("./pages/SystemDemo"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  const [queryClient] = useState(createQueryClient);
  
  return (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <NetworkStatusIndicator />
          <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/features" element={<Features />} />
            <Route
              path="/select-organization"
              element={
                <ProtectedRoute>
                  <SelectOrganization />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/import"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ImportData />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Requests />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <RequestDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Suppliers />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CalendarPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <TasksPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ChatPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProfilePage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/organization/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <OrganizationSettings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent-report"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AgentReport />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent-act-report"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AgentActReport />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/percent-calculator"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <PercentCalculator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-analytics"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AIAnalytics />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-assistant"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AIAssistant />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/spare-parts"
              element={
                <ProtectedRoute>
                  <SpareParts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/system-demo"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SystemDemo />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
