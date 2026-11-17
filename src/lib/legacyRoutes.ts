export type LegacyRouteRule = {
  prefix: string;
  destinations: string[];
  preserveTask?: boolean;
};

/** Старые экраны не открываются: адрес ведёт в ближайший рабочий раздел. */
export const LEGACY_ROUTE_RULES: LegacyRouteRule[] = [
  { prefix: "/agent-act-report", destinations: ["/agent-report?tab=act", "/requests"] },
  { prefix: "/analytics/day-prep", destinations: ["/tasks", "/requests"] },
  { prefix: "/analytics/ai", destinations: ["/analytics/requests", "/agent-report", "/requests"] },
  { prefix: "/ai-analytics", destinations: ["/analytics/requests", "/agent-report", "/requests"] },
  { prefix: "/dashboard", destinations: ["/requests", "/executive"] },
  { prefix: "/board", destinations: ["/requests", "/tasks"] },
  { prefix: "/planner", destinations: ["/tasks", "/requests"], preserveTask: true },
  { prefix: "/my-planner", destinations: ["/tasks", "/requests"], preserveTask: true },
];

export function legacyRouteCandidates(pathname: string, search = ""): string[] {
  const rule = LEGACY_ROUTE_RULES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!rule) return [];

  return rule.destinations.map((destination, index) => {
    if (index !== 0 || !rule.preserveTask) return destination;
    const task = new URLSearchParams(search).get("task");
    if (!task) return destination;
    return `${destination}?task=${encodeURIComponent(task)}`;
  });
}

export function resolveLegacyRoute(
  pathname: string,
  search: string,
  hasRouteAccess: (pathname: string) => boolean,
): string {
  const destination = legacyRouteCandidates(pathname, search).find((candidate) =>
    hasRouteAccess(candidate.split(/[?#]/, 1)[0]),
  );
  return destination ?? "/me";
}
