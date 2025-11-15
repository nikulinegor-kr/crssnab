import { createContext, useContext, ReactNode, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Request } from "@/hooks/useRequests";

interface DemoContextType {
  isDemoMode: boolean;
  demoRequests: Request[];
  addDemoRequest: (request: Request) => void;
  updateDemoRequest: (id: string, updates: Partial<Request>) => void;
  deleteDemoRequest: (id: string) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export const DemoProvider = ({ children }: { children: ReactNode }) => {
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get("demo") === "true";
  const [demoRequests, setDemoRequests] = useState<Request[]>([]);

  const addDemoRequest = (request: Request) => {
    setDemoRequests(prev => [request, ...prev]);
  };

  const updateDemoRequest = (id: string, updates: Partial<Request>) => {
    setDemoRequests(prev => 
      prev.map(req => req.id === id ? { ...req, ...updates } : req)
    );
  };

  const deleteDemoRequest = (id: string) => {
    setDemoRequests(prev => prev.filter(req => req.id !== id));
  };

  return (
    <DemoContext.Provider value={{ 
      isDemoMode, 
      demoRequests,
      addDemoRequest,
      updateDemoRequest,
      deleteDemoRequest
    }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemoMode = () => {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error("useDemoMode must be used within a DemoProvider");
  }
  return context;
};
