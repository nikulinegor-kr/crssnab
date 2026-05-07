import { useState, useEffect, useCallback } from "react";
import { useToast } from "./use-toast";

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const usePushNotifications = () => {
  const { toast } = useToast();
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission as PermissionState);
      
      // Register service worker
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered:', reg);
          setRegistration(reg);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
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

    try {
      if (registration) {
        await registration.showNotification(title, {
          body: options?.body,
          icon: '/favicon.png',
          badge: '/favicon.png',
          tag: options?.tag,
          data: { url: options?.link || '/dashboard' }
        });
        return true;
      } else {
        // Fallback to regular Notification API
        new Notification(title, {
          body: options?.body,
          icon: '/favicon.png',
          tag: options?.tag
        });
        return true;
      }
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
