import { createContext, useContext, ReactNode } from "react";

export type PlannerScope = "auto" | "manual";

const PlannerScopeContext = createContext<PlannerScope>("auto");

export function PlannerScopeProvider({
  scope,
  children,
}: {
  scope: PlannerScope;
  children: ReactNode;
}) {
  return (
    <PlannerScopeContext.Provider value={scope}>
      {children}
    </PlannerScopeContext.Provider>
  );
}

export function usePlannerScope(): PlannerScope {
  return useContext(PlannerScopeContext);
}

export function plannerBasePath(scope: PlannerScope): string {
  return scope === "manual" ? "/my-planner" : "/planner";
}
