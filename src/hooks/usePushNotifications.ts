import { useState, useEffect, useCallback } from "react";
import { useToast } from "./use-toast";

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const usePushNotifications = () => {
  const { toast } = useToast();
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const supported = 'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission as PermissionState);

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration()
          .then((reg) => {
            setRegistration(reg ?? null);
          })
          .catch((error) => {
            console.error('Failed to get Service Worker registration:', error);
          });
      }
    } else {
      setPermission('unsupported');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: "Не поддерживается",
        description: "Ваш браузер не поддерживает push-уведомления",
        variant: "destructive",
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result === 'granted') {
        toast({
          title: "Уведомления включены",
          description: "Вы будете получать push-уведомления о событиях",
        });
        return true;
      } else if (result === 'denied') {
        toast({
          title: "Уведомления заблокированы",
          description: "Вы можете включить их в настройках браузера",
          variant: "destructive",
        });
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось запросить разрешение на уведомления",
        variant: "destructive",
      });
      return false;
    }
  }, [isSupported, toast]);

  const sendNotification = useCallback(async (title: string, options?: { body?: string; link?: string; tag?: string }) => {
    if (permission !== 'granted') {
      console.log('Notification permission not granted');
      return false;
    }

    // Запись в локальный лог
    try {
      const PUSH_LOG_KEY = "crss-push-log-v1";
      const raw = localStorage.getItem(PUSH_LOG_KEY);
      const log = raw ? JSON.parse(raw) : [];
      log.unshift({ title, body: options?.body || "", link: options?.link || null, ts: new Date().toISOString() });
      localStorage.setItem(PUSH_LOG_KEY, JSON.stringify(log.slice(0, 30)));
    } catch (_) { /* noop */ }

    // Звук
    try {
      if (localStorage.getItem("crss-push-sound") !== "off") {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.setValueAtTime(880, ctx.currentTime);
          o.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
          o.connect(g); g.connect(ctx.destination);
          o.start(); o.stop(ctx.currentTime + 0.36);
        }
      }
    } catch (_) { /* noop */ }

    try {
      const reg = registration ?? (await navigator.serviceWorker?.getRegistration());
      if (reg && reg.active) {
        reg.active.postMessage({
          type: 'show-notification',
          title,
          body: options?.body,
          url: options?.link || '/dashboard',
          tag: options?.tag,
          icon: '/favicon.png',
          badge: '/favicon.png',
        });
        return true;
      }
      // Fallback: Notification API напрямую
      const n = new Notification(title, {
        body: options?.body,
        icon: '/favicon.png',
        tag: options?.tag,
      });
      n.onclick = () => { window.focus(); window.location.href = options?.link || '/dashboard'; n.close(); };
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }, [permission, registration]);

  return {
    permission,
    isSupported,
    isEnabled: permission === 'granted',
    requestPermission,
    sendNotification,
  };
};
