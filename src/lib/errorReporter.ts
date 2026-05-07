/**
 * Lightweight client-side error reporter.
 * - Captures window.onerror, unhandledrejection, and manual reports
 * - Adds bootstrap context (load timing, protocol, connection, route)
 * - Batches/throttles to avoid storms; sendBeacon when available
 */

type Severity = "error" | "warning" | "info";

interface ReportPayload {
  message: string;
  stack?: string;
  url?: string;
  user_agent?: string;
  severity?: Severity;
  organization_id?: string | null;
  context?: Record<string, unknown>;
}

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-client-error`;
const APIKEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const BOOT_TIME = performance.now();
const seen = new Map<string, number>();
const DEDUP_MS = 10_000;
const MAX_PER_MIN = 20;
let sentInWindow = 0;
let windowStart = Date.now();

function shouldSend(key: string): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= MAX_PER_MIN) return false;
  const last = seen.get(key) ?? 0;
  if (now - last < DEDUP_MS) return false;
  seen.set(key, now);
  sentInWindow++;
  return true;
}

function bootstrapContext(): Record<string, unknown> {
  const nav = (navigator as unknown as { connection?: { effectiveType?: string; rtt?: number; downlink?: number } }).connection;
  const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return {
    elapsed_since_boot_ms: Math.round(performance.now() - BOOT_TIME),
    route: typeof location !== "undefined" ? location.pathname + location.search : null,
    protocol: navEntry?.nextHopProtocol ?? null, // h2, http/1.1
    transfer_size: navEntry?.transferSize ?? null,
    encoded_body_size: navEntry?.encodedBodySize ?? null,
    response_start_ms: navEntry ? Math.round(navEntry.responseStart) : null,
    response_end_ms: navEntry ? Math.round(navEntry.responseEnd) : null,
    dom_interactive_ms: navEntry ? Math.round(navEntry.domInteractive) : null,
    dom_complete_ms: navEntry ? Math.round(navEntry.domComplete) : null,
    connection_type: nav?.effectiveType ?? null,
    connection_rtt: nav?.rtt ?? null,
    connection_downlink: nav?.downlink ?? null,
    viewport: typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
      : null,
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
  };
}

function getOrgId(): string | null {
  try {
    return localStorage.getItem("currentOrganizationId");
  } catch {
    return null;
  }
}

export function reportError(payload: ReportPayload): void {
  const key = `${payload.severity ?? "error"}|${payload.message}`.slice(0, 200);
  if (!shouldSend(key)) return;

  const body = JSON.stringify({
    message: payload.message?.slice(0, 2000) ?? "Unknown",
    stack: payload.stack?.slice(0, 8000),
    url: payload.url ?? location.href,
    user_agent: navigator.userAgent,
    severity: payload.severity ?? "error",
    organization_id: payload.organization_id ?? getOrgId(),
    context: { ...bootstrapContext(), ...(payload.context ?? {}) },
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      // sendBeacon ignores headers; the function accepts anonymous calls
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    }
  } catch {
    /* fall back to fetch */
  }

  try {
    void fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: APIKEY,
      },
      body,
    });
  } catch {
    /* swallow */
  }
}

export function installGlobalErrorReporter(): void {
  if (typeof window === "undefined") return;
  if ((window as unknown as { __errorReporterInstalled?: boolean }).__errorReporterInstalled) return;
  (window as unknown as { __errorReporterInstalled?: boolean }).__errorReporterInstalled = true;

  window.addEventListener("error", (event) => {
    const err = event.error as Error | undefined;
    reportError({
      message: err?.message || event.message || "window.onerror",
      stack: err?.stack,
      severity: "error",
      context: {
        source: "window.onerror",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    const err = reason instanceof Error ? reason : undefined;
    reportError({
      message: err?.message || (typeof reason === "string" ? reason : "unhandledrejection"),
      stack: err?.stack,
      severity: "error",
      context: { source: "unhandledrejection" },
    });
  });

  // Boot watchdog: if app doesn't render within 12s, report
  const watchdog = window.setTimeout(() => {
    const root = document.getElementById("root");
    const rendered = root && root.children.length > 0;
    if (!rendered) {
      reportError({
        message: "Boot watchdog: app did not render within 12s",
        severity: "warning",
        context: { source: "boot_watchdog", root_children: root?.children.length ?? 0 },
      });
    }
  }, 12_000);

  window.addEventListener("load", () => {
    // App boot completed; cancel watchdog if root has content
    setTimeout(() => {
      const root = document.getElementById("root");
      if (root && root.children.length > 0) clearTimeout(watchdog);
    }, 0);
  });
}
