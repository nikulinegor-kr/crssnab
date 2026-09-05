import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useToast } from "@/hooks/use-toast";

/** Переключатель быстрого входа по Face ID. Виден только в мобильном приложении. */
export const BiometricSettingCard = () => {
  const { isNativeApp, available, biometryLabel, enabled, enableBiometric, disableBiometric } =
    useBiometricAuth();
  const { toast } = useToast();

  if (!isNativeApp || !available) return null;

  const handleToggle = async (next: boolean) => {
    if (next) {
      const ok = await enableBiometric();
      toast({
        title: ok ? "Готово" : "Не удалось включить",
        description: ok
          ? `Вход по ${biometryLabel} включён`
          : "Попробуйте войти заново и повторить",
        variant: ok ? undefined : "destructive",
      });
    } else {
      await disableBiometric();
      toast({ title: "Выключено", description: `Вход по ${biometryLabel} отключён` });
    }
  };

  return (
    <div className="flex items-center justify-between py-4">
      <div className="space-y-0.5">
        <Label htmlFor="biometric">Быстрый вход по {biometryLabel}</Label>
        <p className="text-sm text-muted-foreground">
          Входить без пароля на этом устройстве
        </p>
      </div>
      <Switch id="biometric" checked={enabled} onCheckedChange={(v) => void handleToggle(v)} />
    </div>
  );
};

export default BiometricSettingCard;
