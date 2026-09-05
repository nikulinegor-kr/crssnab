import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2 } from "lucide-react";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

/**
 * Кнопка входа по Face ID на экране авторизации.
 * Показывается только в мобильном приложении, если быстрый вход включён.
 */
export const BiometricLoginButton = () => {
  const { isNativeApp, available, enabled, isChecking, biometryLabel, signInWithBiometric } =
    useBiometricAuth();
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);

  const run = async () => {
    setBusy(true);
    await signInWithBiometric();
    setBusy(false);
  };

  useEffect(() => {
    if (isNativeApp && available && enabled && !autoTried.current) {
      autoTried.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNativeApp, available, enabled]);

  if (!isNativeApp || isChecking || !available || !enabled) return null;

  return (
    <div className="mb-4">
      <Button type="button" variant="outline" className="w-full" onClick={() => void run()} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
        Войти по {biometryLabel}
      </Button>
    </div>
  );
};

export default BiometricLoginButton;
