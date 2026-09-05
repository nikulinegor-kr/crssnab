import { Capacitor } from "@capacitor/core";

/** true только внутри собранного мобильного приложения (iOS/Android). */
export const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const nativePlatform = (): "ios" | "android" | "web" => {
  try {
    const p = Capacitor.getPlatform();
    return p === "ios" || p === "android" ? p : "web";
  } catch {
    return "web";
  }
};

export const isIOSApp = (): boolean => isNative() && nativePlatform() === "ios";
