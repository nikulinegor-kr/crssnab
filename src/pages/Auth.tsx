import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import BiometricLoginButton from "@/components/native/BiometricLoginButton";
import LoginShell from "@/components/auth/LoginShell";
import { parseAuthMode, safeNext, preferredAuthDestination, type AuthMode } from "@/lib/authNavigation";

import { CONSENT_PATH, CONSENT_VERSION, PRIVACY_PATH } from "@/lib/personalDataConsent";

const loginSchema = z.object({
  email: z.string().email("Неверный формат email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

const signupSchema = z.object({
  organizationName: z.string().min(2, "Название организации обязательно"),
  inn: z.string().min(10, "ИНН должен содержать минимум 10 цифр"),
  email: z.string().email("Неверный формат email"),
  phone: z.string().min(10, "Введите корректный номер телефона"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  confirmPassword: z.string(),
  personalDataConsent: z.boolean().refine(Boolean, "Подтвердите согласие для регистрации"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

const forgotSchema = z.object({ email: z.string().email("Неверный формат email") });
const resetSchema = z.object({
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;
type ForgotFormData = z.infer<typeof forgotSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

const TITLES: Record<AuthMode, string> = {
  login: "Вход",
  signup: "Регистрация",
  forgot: "Восстановление пароля",
  reset: "Восстановление пароля",
};

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const explicitDestination = params.has("next");
  const next = safeNext(params.get("next"));
  const mode = parseAuthMode(params.get("mode"));

  const setMode = (value: AuthMode) => {
    setRecoverySent(false);
    setParams((previous) => {
      const updated = new URLSearchParams(previous);
      if (value === "login") updated.delete("mode");
      else updated.set("mode", value);
      return updated;
    }, { replace: true });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && mode !== "reset") window.location.href = explicitDestination ? next : preferredAuthDestination(next, session.user.id, localStorage.getItem("currentOrganizationId"));
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mode !== "reset") window.location.href = explicitDestination ? next : preferredAuthDestination(next, session.user.id, localStorage.getItem("currentOrganizationId"));
    });
    return () => subscription.unsubscribe();
  }, [mode, next, explicitDestination]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { organizationName: "", inn: "", email: "", phone: "", password: "", confirmPassword: "", personalDataConsent: false },
  });
  const forgotForm = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });
  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const showError = (error: any, fallback: string, retry: () => void) => {
    const isNetworkError = error?.message === "Failed to fetch" || error?.message === "Load failed" || /fetch|network/i.test(error?.message || "");
    let description = error?.message || fallback;
    if (isNetworkError) description = "Ошибка сети. Проверьте подключение к интернету или попробуйте отключить VPN.";
    else if (error?.message?.includes("Invalid login")) description = "Неверный email или пароль";
    else if (error?.message?.includes("already registered")) description = "Пользователь с таким email уже зарегистрирован";
    toast({
      variant: "destructive",
      title: "Ошибка",
      description,
      action: isNetworkError ? <Button variant="outline" size="sm" onClick={retry} className="shrink-0">Повторить</Button> : undefined,
    });
  };

  const onLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
      if (error) throw error;
      toast({ title: "Успешно", description: "Вы вошли в систему" });
    } catch (error: any) {
      showError(error, "Не удалось войти", () => loginForm.handleSubmit(onLogin)());
    } finally {
      setIsLoading(false);
    }
  };

  const onSignup = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const { error, data: authData } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}${next}`,
          data: { organization_name: data.organizationName, inn: data.inn, phone: data.phone, personal_data_consent_version: CONSENT_VERSION },
        },
      });
      if (error) throw error;
      if (authData.user) toast({ title: "Регистрация завершена", description: "Проверьте почту для подтверждения аккаунта." });
    } catch (error: any) {
      showError(error, "Не удалось зарегистрироваться", () => signupForm.handleSubmit(onSignup)());
    } finally {
      setIsLoading(false);
    }
  };

  const onForgot = async (data: ForgotFormData) => {
    setIsLoading(true);
    try {
      const redirect = new URL("/auth", window.location.origin);
      redirect.searchParams.set("mode", "reset");
      redirect.searchParams.set("next", next);
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, { redirectTo: redirect.toString() });
      if (error) throw error;
      setRecoverySent(true);
    } catch (error: any) {
      showError(error, "Не удалось отправить письмо", () => forgotForm.handleSubmit(onForgot)());
    } finally {
      setIsLoading(false);
    }
  };

  const onReset = async (data: ResetFormData) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ссылка для сброса недействительна или устарела. Запросите новую.");
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw error;
      toast({ title: "Пароль обновлён", description: "Выполняется вход в CRSS CRM." });
      window.location.href = explicitDestination ? next : preferredAuthDestination(next, session.user.id, localStorage.getItem("currentOrganizationId"));
    } catch (error: any) {
      showError(error, "Не удалось обновить пароль", () => resetForm.handleSubmit(onReset)());
    } finally {
      setIsLoading(false);
    }
  };

  const lead = mode === "forgot"
    ? "Отправим ссылку для смены пароля на ваш email."
    : mode === "reset"
      ? "Задайте новый пароль для своего аккаунта."
      : undefined;

  return (
    <LoginShell role="admin" title={TITLES[mode]} lead={lead} showRoleSwitch={false}>
      {(mode === "login" || mode === "signup") && (
        <div className="crss-auth-tabs" aria-label="Действие">
          <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")}>Вход</button>
          <button type="button" aria-pressed={mode === "signup"} onClick={() => setMode("signup")}>Регистрация</button>
        </div>
      )}

      {mode === "login" && (
        <>
          <BiometricLoginButton />
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="auth-email" className="crss-label">Email</Label>
              <Input id="auth-email" type="email" autoComplete="email" placeholder="your@email.com" className="crss-field text-sm" {...loginForm.register("email")} />
              {loginForm.formState.errors.email && <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="auth-password" className="crss-label">Пароль</Label>
              <Input id="auth-password" type="password" autoComplete="current-password" placeholder="••••••••" className="crss-field text-sm" {...loginForm.register("password")} />
              {loginForm.formState.errors.password && <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full crss-submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Войти
            </Button>
            <button type="button" className="crss-link text-sm" onClick={() => setMode("forgot")}>Забыли пароль?</button>
          </form>
        </>
      )}

      {mode === "signup" && (
        <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="signup-email" className="crss-label">Email</Label>
            <Input id="signup-email" type="email" autoComplete="email" placeholder="your@email.com" className="crss-field text-sm" {...signupForm.register("email")} />
            {signupForm.formState.errors.email && <p className="text-xs text-destructive">{signupForm.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="organizationName" className="crss-label">Название организации</Label>
            <Input id="organizationName" autoComplete="organization" placeholder="ООО Компания" className="crss-field text-sm" {...signupForm.register("organizationName")} />
            {signupForm.formState.errors.organizationName && <p className="text-xs text-destructive">{signupForm.formState.errors.organizationName.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="inn" className="crss-label">ИНН</Label>
              <Input id="inn" inputMode="numeric" placeholder="1234567890" className="crss-field text-sm" {...signupForm.register("inn")} />
              {signupForm.formState.errors.inn && <p className="text-xs text-destructive">{signupForm.formState.errors.inn.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone" className="crss-label">Телефон</Label>
              <Input id="phone" type="tel" autoComplete="tel" placeholder="+7 (999) 123-45-67" className="crss-field text-sm" {...signupForm.register("phone")} />
              {signupForm.formState.errors.phone && <p className="text-xs text-destructive">{signupForm.formState.errors.phone.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="signup-password" className="crss-label">Пароль</Label>
            <Input id="signup-password" type="password" autoComplete="new-password" placeholder="••••••••" className="crss-field text-sm" {...signupForm.register("password")} />
            {signupForm.formState.errors.password && <p className="text-xs text-destructive">{signupForm.formState.errors.password.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword" className="crss-label">Подтвердите пароль</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" className="crss-field text-sm" {...signupForm.register("confirmPassword")} />
            {signupForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>}
          </div>
          <div className="space-y-2 text-sm leading-relaxed">
            <div className="flex items-start gap-3">
              <input id="personal-data-consent" type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" aria-invalid={!!signupForm.formState.errors.personalDataConsent} aria-describedby="personal-data-consent-text" {...signupForm.register("personalDataConsent")} />
              <label htmlFor="personal-data-consent">Даю согласие на обработку персональных данных для регистрации в CRSS</label>
            </div>
            <div id="personal-data-consent-text" className="pl-7">
              <Link className="crss-link" to={CONSENT_PATH} target="_blank" rel="noopener">Текст согласия</Link>
              {signupForm.formState.errors.personalDataConsent && <p role="alert" className="text-destructive">{signupForm.formState.errors.personalDataConsent.message}</p>}
            </div>
          </div>
          <Button type="submit" className="w-full crss-submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Создать аккаунт
          </Button>
        </form>
      )}

      {mode === "forgot" && (recoverySent ? (
        <div className="crss-auth-notice" role="status">
          <p>Ссылка отправлена на <strong>{forgotForm.getValues("email")}</strong>.</p>
          <button type="button" className="crss-link text-sm" onClick={() => setRecoverySent(false)}>Отправить повторно</button>
        </div>
      ) : (
        <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="forgot-email" className="crss-label">Email</Label>
            <Input id="forgot-email" type="email" autoComplete="email" placeholder="your@email.com" className="crss-field text-sm" {...forgotForm.register("email")} />
            {forgotForm.formState.errors.email && <p className="text-xs text-destructive">{forgotForm.formState.errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full crss-submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Отправить ссылку
          </Button>
        </form>
      ))}

      {mode === "reset" && (
        <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="reset-password" className="crss-label">Новый пароль</Label>
            <Input id="reset-password" type="password" autoComplete="new-password" placeholder="••••••••" className="crss-field text-sm" {...resetForm.register("password")} />
            {resetForm.formState.errors.password && <p className="text-xs text-destructive">{resetForm.formState.errors.password.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="reset-confirm" className="crss-label">Подтвердите пароль</Label>
            <Input id="reset-confirm" type="password" autoComplete="new-password" placeholder="••••••••" className="crss-field text-sm" {...resetForm.register("confirmPassword")} />
            {resetForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{resetForm.formState.errors.confirmPassword.message}</p>}
          </div>
          <Button type="submit" className="w-full crss-submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Сохранить пароль
          </Button>
        </form>
      )}

      {(mode === "forgot" || mode === "reset") && (
        <button type="button" className="crss-link text-sm" onClick={() => setMode("login")}>Вернуться ко входу</button>
      )}
      <Link to={PRIVACY_PATH} target="_blank" rel="noopener" className="mt-4 inline-block crss-link text-sm">Политика обработки персональных данных</Link>
    </LoginShell>
  );
}
