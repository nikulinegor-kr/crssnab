import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isNative, nativePlatform } from "@/lib/native";

const registerToken = async (token: string) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  let organizationId: string | null = null;
  try {
    const { data } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    organizationId = data?.organization_id ?? null;
  } catch {
    /* организация не обязательна */
  }

  await supabase
    .from("device_push_tokens")
    .upsert(
      {
        user_id: user.id,
        organization_id: organizationId,
        token,
        platform: nativePlatform() === "android" ? "android" : "ios",
      },
      { onConflict: "token" }
    );
};

/**
 * Регистрация устройства в Apple Push и обработка нажатий по уведомлению.
 * В браузере ничего не делает — веб-уведомления работают как раньше.
 */
export const useNativePush = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative()) return;
    let disposed = false;
    const handles: Array<{ remove: () => Promise<void> | void }> = [];

    const setup = async () => {
      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== "granted") return;

        handles.push(
          await PushNotifications.addListener("registration", (token) => {
            void registerToken(token.value);
          })
        );
        handles.push(
          await PushNotifications.addListener("registrationError", (err) => {
            console.error("[push] registration error", err);
          })
        );
        handles.push(
          await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            const route = (action.notification?.data as Record<string, unknown> | undefined)?.route;
            if (typeof route === "string" && route.startsWith("/")) {
              navigate(route);
            }
          })
        );

        await PushNotifications.register();
      } catch (e) {
        console.error("[push] setup failed", e);
      }
    };

    void setup();

    return () => {
      disposed = true;
      void disposed;
      handles.forEach((h) => {
        void h.remove();
      });
    };
  }, [navigate]);
};

/** Удаление токена текущего устройства при выходе из аккаунта. */
export const unregisterPushToken = async (token?: string) => {
  if (!isNative()) return;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    const query = supabase.from("device_push_tokens").delete().eq("user_id", userId);
    await (token ? query.eq("token", token) : query);
  } catch {
    /* ignore */
  }
};
