import { lazy, ComponentType, createElement } from "react";

type ComponentImport<T> = () => Promise<{ default: T }>;

/**
 * Lazy load a component with automatic retry on chunk loading errors.
 * This handles cases where:
 * - Cached scripts become stale after deployments
 * - Network issues during module loading
 * - Temporary CDN/server issues
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: ComponentImport<T>,
  retries = 3,
  interval = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const sessionKey = `retry-lazy-refreshed-${componentImport.toString().slice(0, 50)}`;
    let lastError: unknown = null;
    
    for (let i = 0; i < retries; i++) {
      try {
        const module = await componentImport();
        // Clear the session flag on successful load
        sessionStorage.removeItem(sessionKey);
        return module;
      } catch (error) {
        lastError = error;
        console.warn(`[LazyLoad] Retry ${i + 1}/${retries} failed:`, error);
        
        if (i < retries - 1) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, interval * (i + 1)));
        }
      }
    }
    
    // All retries failed - check if we already tried refreshing
    const hasRefreshed = sessionStorage.getItem(sessionKey);
    
    if (!hasRefreshed) {
      // Mark that we're about to refresh and reload the page
      sessionStorage.setItem(sessionKey, "true");
      console.warn("[LazyLoad] All retries failed, reloading page...");
      window.location.reload();
    }
    
    const LazyLoadFallback = (() => createElement(
      "div",
      { className: "min-h-screen bg-background text-foreground flex items-center justify-center p-4" },
      createElement(
        "div",
        { className: "w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm space-y-4" },
        createElement("h1", { className: "text-xl font-semibold text-foreground" }, "Не удалось загрузить страницу"),
        createElement(
          "p",
          { className: "text-sm text-muted-foreground" },
          "Приложение не смогло загрузить нужный модуль. Попробуйте обновить страницу или вернуться на главную."
        ),
        import.meta.env.DEV && lastError
          ? createElement(
              "pre",
              {
                className: "max-h-40 overflow-auto rounded-md border border-border bg-muted p-3 text-left text-xs text-destructive whitespace-pre-wrap",
              },
              lastError instanceof Error ? lastError.message : String(lastError)
            )
          : null,
        createElement(
          "div",
          { className: "flex flex-col gap-2 sm:flex-row sm:justify-center" },
          createElement(
            "button",
            {
              className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90",
              onClick: () => window.location.reload(),
              type: "button",
            },
            "Обновить страницу"
          ),
          createElement(
            "button",
            {
              className: "inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
              onClick: () => {
                window.location.href = "/";
              },
              type: "button",
            },
            "На главную"
          )
        )
      )
    )) as unknown as T;

    return {
      default: LazyLoadFallback,
    };
  });
}
