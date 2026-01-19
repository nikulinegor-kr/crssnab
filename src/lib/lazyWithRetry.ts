import { lazy, ComponentType } from "react";

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
    
    for (let i = 0; i < retries; i++) {
      try {
        const module = await componentImport();
        // Clear the session flag on successful load
        sessionStorage.removeItem(sessionKey);
        return module;
      } catch (error) {
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
    
    // Return a fallback component that shows a reload button
    return {
      default: (() => null) as unknown as T
    };
  });
}
