import { useCallback, useEffect, useState } from "react";
import { NativeBiometric, BiometryType } from "capacitor-native-biometric";
import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/native";

const SERVER = "crssnab.biometric";
const FLAG_KEY = "biometric_enabled";

/**
 * Быстрый вход по Face ID / Touch ID.
 * Пароль вводится один раз, дальше сессия восстанавливается из Keychain
 * после успешной биометрии. Запасной вход по паролю остаётся всегда.
 */
export const useBiometricAuth = () => {
  const [available, setAvailable] = useState(false);
  const [biometryLabel, setBiometryLabel] = useState("Биометрия");
  const [enabled, setEnabled] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!isNative()) {
        if (!cancelled) setIsChecking(false);
        return;
      }
      try {
        const result = await NativeBiometric.isAvailable({ useFallback: true });
        if (cancelled) return;
        setAvailable(!!result.isAvailable);
        if (result.biometryType === BiometryType.FACE_ID) setBiometryLabel("Face ID");
        else if (result.biometryType === BiometryType.TOUCH_ID) setBiometryLabel("Touch ID");

        const { value } = await Preferences.get({ key: FLAG_KEY });
        if (!cancelled) setEnabled(value === "true");
      } catch {
        if (!cancelled) setAvailable(false);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Сохранить текущую сессию под защитой биометрии. */
  const enableBiometric = useCallback(async (): Promise<boolean> => {
    if (!isNative()) return false;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.refresh_token) return false;

    try {
      await NativeBiometric.setCredentials({
        server: SERVER,
        username: session.user?.email ?? session.user.id,
        password: session.refresh_token,
      });
      await Preferences.set({ key: FLAG_KEY, value: "true" });
      setEnabled(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const disableBiometric = useCallback(async () => {
    try {
      await NativeBiometric.deleteCredentials({ server: SERVER });
    } catch {
      /* ignore */
    }
    await Preferences.set({ key: FLAG_KEY, value: "false" });
    setEnabled(false);
  }, []);

  /** Запросить Face ID и восстановить сессию. */
  const signInWithBiometric = useCallback(async (): Promise<boolean> => {
    if (!isNative()) return false;
    try {
      await NativeBiometric.verifyIdentity({
        reason: "Вход в CRSS",
        title: "Подтвердите личность",
        subtitle: "Вход по биометрии",
        useFallback: true,
      });
      const creds = await NativeBiometric.getCredentials({ server: SERVER });
      if (!creds?.password) return false;

      const { error } = await supabase.auth.refreshSession({ refresh_token: creds.password });
      if (error) {
        await disableBiometric();
        return false;
      }
      // Обновляем сохранённый refresh-токен на свежий
      const { data } = await supabase.auth.getSession();
      if (data.session?.refresh_token) {
        await NativeBiometric.setCredentials({
          server: SERVER,
          username: data.session.user?.email ?? data.session.user.id,
          password: data.session.refresh_token,
        });
      }
      return true;
    } catch {
      return false;
    }
  }, [disableBiometric]);

  return {
    isNativeApp: isNative(),
    available,
    biometryLabel,
    enabled,
    isChecking,
    enableBiometric,
    disableBiometric,
    signInWithBiometric,
  };
};
