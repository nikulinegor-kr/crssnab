import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNative } from "@/lib/native";
import { useNativePush } from "@/hooks/useNativePush";

/**
 * Мобильная оболочка: статус-бар, заставка, кнопка «назад», deep links, пуши.
 * В браузере компонент ничего не рендерит и не влияет на поведение сайта.
 */
export const NativeShell = () => {
  const navigate = useNavigate();
  useNativePush();

  useEffect(() => {
    if (!isNative()) return;
    const handles: Array<{ remove: () => Promise<void> | void }> = [];

    const init = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Light });
      } catch {
        /* not supported */
      }
      try {
        await SplashScreen.hide();
      } catch {
        /* ignore */
      }

      try {
        handles.push(
          await CapApp.addListener("appUrlOpen", ({ url }) => {
            try {
              const parsed = new URL(url);
              const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
              if (path && path !== "/") navigate(path);
            } catch {
              /* ignore malformed url */
            }
          })
        );
        handles.push(
          await CapApp.addListener("backButton", ({ canGoBack }) => {
            if (canGoBack) window.history.back();
            else void CapApp.exitApp();
          })
        );
      } catch {
        /* ignore */
      }
    };

    void init();

    return () => {
      handles.forEach((h) => {
        void h.remove();
      });
    };
  }, [navigate]);

  return null;
};

export default NativeShell;
