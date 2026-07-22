import { createRoot } from "react-dom/client";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./index.css";
import { installGlobalErrorReporter, reportError } from "./lib/errorReporter";

installGlobalErrorReporter();

const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app");

const setupNotificationServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return;

  // В preview/iframe — снимаем регистрацию, чтобы не кэшировать сборки
  if (isInIframe || isPreviewHost) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((c) => caches.delete(c)));
      }
    } catch (e) {
      console.error("SW cleanup failed:", e);
    }
    return;
  }

  // В production — регистрируем SW для уведомлений
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.error("SW registration failed:", e);
  }

  // Навигация по сообщениям от SW (клик по уведомлению)
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "navigate" && typeof data.url === "string") {
      window.location.href = data.url;
    }
  });
};

type BootstrapState = "loading" | "slow" | "error";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found");
}

const root = createRoot(rootElement);

function BootstrapScreen({ state, errorMessage }: { state: BootstrapState; errorMessage?: string }) {
  const title = state === "error" ? "Не удалось загрузить приложение" : "Загрузка приложения";
  const description = state === "error"
    ? "Во время запуска произошла ошибка. Попробуйте обновить страницу или вернуться на главную."
    : state === "slow"
      ? "Запуск занимает дольше обычного. Мы продолжаем загрузку и восстановление данных."
      : "Подготавливаем рабочее пространство…";

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {state === "error" && errorMessage ? (
          <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted p-3 text-left text-xs text-destructive whitespace-pre-wrap">
            {errorMessage}
          </pre>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Обновить страницу
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            На главную
          </button>
        </div>
      </div>
    </div>
  );
}

root.render(<BootstrapScreen state="loading" />);

const scheduleCleanup = () => {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback) => number;
  };

  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(() => {
      void setupNotificationServiceWorker();
    });
    return;
  }

  window.setTimeout(() => {
    void setupNotificationServiceWorker();
  }, 1500);
};

const bootstrapApp = async () => {
  let slowBootTimer: ReturnType<typeof setTimeout> | undefined;

  try {
    slowBootTimer = setTimeout(() => {
      root.render(<BootstrapScreen state="slow" />);
      reportError({
        message: "Slow bootstrap: App import >4s",
        severity: "warning",
        context: { source: "bootstrap_slow" },
      });
    }, 4000);

    const { default: App } = await import("./App.tsx");

    if (slowBootTimer) {
      window.clearTimeout(slowBootTimer);
    }

    root.render(<App />);
    scheduleCleanup();
  } catch (error) {
    if (slowBootTimer) {
      window.clearTimeout(slowBootTimer);
    }

    console.error("[Bootstrap] Failed to start app:", error);

    reportError({
      message: error instanceof Error ? error.message : "Bootstrap failed",
      stack: error instanceof Error ? error.stack : undefined,
      severity: "error",
      context: { source: "bootstrap" },
    });

    root.render(
      <BootstrapScreen
        state="error"
        errorMessage={import.meta.env.DEV && error instanceof Error ? error.message : undefined}
      />
    );
  }
};

void bootstrapApp();
