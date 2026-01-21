import { useState, useEffect, useCallback } from "react";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/favicon.ico", {
        method: "HEAD",
        cache: "no-cache",
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  return { isOnline, wasOffline, checkConnection };
}
