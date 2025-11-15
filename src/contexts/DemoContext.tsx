import { createContext, useContext, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

interface DemoContextType {
  isDemoMode: boolean;
}

const DemoContext = createContext<DemoContextType>({ isDemoMode: false });

export const DemoProvider = ({ children }: { children: ReactNode }) => {
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get("demo") === "true";

  return (
    <DemoContext.Provider value={{ isDemoMode }}>
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
