/**
 * Lightweight client-side error reporter.
 * - Captures window.onerror, unhandledrejection, manual reports
 * - Captures resource loading failures (script/css/img) and chunk-load errors
 * - Adds bootstrap context (timing, protocol, connection, route, deployment_id)
 * - Throttles & dedupes; sendBeacon when available
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
const MAX_PER_MIN = 30;
let sentInWindow = 0;
let windowStart = Date.now();

// Track failed asset URLs so they can be attached to subsequent errors
const failedAssets: { url: string; tag: string; at: number }[] = [];
function pushFailedAsset(url: string, tag: string) {
  failedAssets.push({ url, tag, at: Date.now() });
  if (failedAssets.length > 20) failedAssets.shift();
}

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

// Try to derive a stable deployment id from the entry script hash
function detectDeploymentId(): string | null {
  try {
    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[type=module][src]"));
    for (const s of scripts) {
      const m = s.src.match(/[/-]([A-Za-z0-9_-]{8,})\.js(?:$|\?)/);
      if (m) return m[1];
    }
  } catch {
    /* ignore */
  }
  return null;
}
const DEPLOYMENT_ID = typeof document !== "undefined" ? detectDeploymentId() : null;

function classifyError(message: string, stack?: string): string | null {
  const s = `${message}\n${stack ?? ""}`;
  if (/ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(s)) {
    return "chunk_load_error";
  }
  if (/NetworkError|Failed to fetch|Load failed/i.test(s)) return "network_error";
  if (/SyntaxError/i.test(s)) return "syntax_error";
  return null;
}

function bootstrapContext(): Record<string, unknown> {
  const nav = (navigator as unknown as {
    connection?: { effectiveType?: string; rtt?: number; downlink?: number; saveData?: boolean };
  }).connection;
  const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return {
    deployment_id: DEPLOYMENT_ID,
    elapsed_since_boot_ms: Math.round(performance.now() - BOOT_TIME),
    route: typeof location !== "undefined" ? location.pathname + location.search : null,
    protocol: navEntry?.nextHopProtocol ?? null,
    transfer_size: navEntry?.transferSize ?? null,
    encoded_body_size: navEntry?.encodedBodySize ?? null,
    response_start_ms: navEntry ? Math.round(navEntry.responseStart) : null,
    response_end_ms: navEntry ? Math.round(navEntry.responseEnd) : null,
    dom_interactive_ms: navEntry ? Math.round(navEntry.domInteractive) : null,
    dom_complete_ms: navEntry ? Math.round(navEntry.domComplete) : null,
    connection_type: nav?.effectiveType ?? null,
    connection_rtt: nav?.rtt ?? null,
    connection_downlink: nav?.downlink ?? null,
    save_data: nav?.saveData ?? null,
    viewport: typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
      : null,
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    failed_assets: failedAssets.length ? failedAssets.slice() : null,
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
  const klass = classifyError(payload.message, payload.stack);
  const key = `${payload.severity ?? "error"}|${klass ?? ""}|${payload.message}`.slice(0, 240);
  if (!shouldSend(key)) return;

  const body = JSON.stringify({
    message: payload.message?.slice(0, 2000) ?? "Unknown",
    stack: payload.stack?.slice(0, 8000),
    url: payload.url ?? location.href,
    user_agent: navigator.userAgent,
    severity: payload.severity ?? "error",
    organization_id: payload.organization_id ?? getOrgId(),
    context: {
      ...bootstrapContext(),
      error_class: klass,
      ...(payload.context ?? {}),
    },
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    }
  } catch {
    /* fall back */
  }

  try {
    void fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", apikey: APIKEY },
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

  // Capture resource loading failures (script/css/img). These bubble only in capture phase.
  window.addEventListener(
    "error",
    (event) => {
      const target = event.target as (HTMLElement & { src?: string; href?: string }) | null;
      if (target && target !== (window as unknown as EventTarget) && (target.tagName === "SCRIPT" || target.tagName === "LINK" || target.tagName === "IMG")) {
        const url = target.src || target.href || "";
        if (url) pushFailedAsset(url, target.tagName);
        reportError({
          message: `Resource load failed: ${target.tagName} ${url}`,
          severity: "error",
          context: {
            source: "resource_error",
            tag: target.tagName,
            asset_url: url,
          },
        });
        return;
      }
      const err = (event as ErrorEvent).error as Error | undefined;
      reportError({
        message: err?.message || (event as ErrorEvent).message || "window.onerror",
        stack: err?.stack,
        severity: "error",
        context: {
          source: "window.onerror",
          filename: (event as ErrorEvent).filename,
          lineno: (event as ErrorEvent).lineno,
          colno: (event as ErrorEvent).colno,
        },
      });
    },
    true, // capture so resource errors are seen
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    const err = reason instanceof Error ? reason : undefined;
    const message = err?.message || (typeof reason === "string" ? reason : "unhandledrejection");
    reportError({
      message,
      stack: err?.stack,
      severity: "error",
      context: { source: "unhandledrejection" },
    });
  });

  // Boot watchdog
  const watchdog = window.setTimeout(() => {
    const root = document.getElementById("root");
    const rendered = root && root.children.length > 0;
    if (!rendered) {
      reportError({
        message: "Boot watchdog: app did not render within 12s",
        severity: "warning",
        context: {
          source: "boot_watchdog",
          render_timeout_reason: failedAssets.length ? "failed_assets" : "unknown",
          root_children: root?.children.length ?? 0,
        },
      });
    }
  }, 12_000);

  window.addEventListener("load", () => {
    setTimeout(() => {
      const root = document.getElementById("root");
      if (root && root.children.length > 0) clearTimeout(watchdog);
    }, 0);
  });
}
