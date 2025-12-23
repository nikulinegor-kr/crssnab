import { lazy, Suspense } from "react";
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

// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ImportData = lazy(() => import("./pages/ImportData"));
const Requests = lazy(() => import("./pages/Requests"));
const RequestDetail = lazy(() => import("./pages/RequestDetail"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const Auth = lazy(() => import("./pages/Auth"));
const SelectOrganization = lazy(() => import("./pages/SelectOrganization"));
const OrganizationSettings = lazy(() => import("./pages/OrganizationSettings"));
const AgentReport = lazy(() => import("./pages/AgentReport"));
const AgentActReport = lazy(() => import("./pages/AgentActReport"));
const PercentCalculator = lazy(() => import("./pages/PercentCalculator"));
const KanbanBoard = lazy(() => import("./pages/KanbanBoard"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Features = lazy(() => import("./pages/Features"));
const Demo = lazy(() => import("./pages/Demo"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const SystemDemo = lazy(() => import("./pages/SystemDemo"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
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
              path="/kanban"
              element={
                <ProtectedRoute>
                  <AppLayout fullBleed hideSubscriptionBanner>
                    <KanbanBoard />
                  </AppLayout>
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

export default App;
