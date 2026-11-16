import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import LoginShell from "@/components/auth/LoginShell";

const loginSchema = z.object({
  email: z.string().email("Неверный формат email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Index() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/select-organization");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/select-organization");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Вы вошли в систему",
      });
    } catch (error: any) {
      const isNetworkError = error.message === "Failed to fetch" || error.message?.includes("fetch");
      let errorMessage = error.message || "Не удалось войти";
      if (isNetworkError) {
        errorMessage = "Ошибка сети. Проверьте подключение к интернету.";
      } else if (error.message?.includes("Invalid login")) {
        errorMessage = "Неверный email или пароль";
      }
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: errorMessage,
        action: isNetworkError ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => form.handleSubmit(onSubmit)()}
            className="shrink-0 border-destructive-foreground/30 text-destructive-foreground hover:bg-destructive-foreground/10"
          >
            Повторить
          </Button>
        ) : undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoginShell role="admin" lead="Для администратора: управление заявками, складом и командой.">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email" className="crss-label">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                className="crss-field text-sm"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="crss-label">
                Пароль
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="crss-field text-sm pr-10"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 crss-muted transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  className="h-4 w-4"
                  onCheckedChange={(checked) => form.setValue("rememberMe", !!checked)}
                />
                <Label htmlFor="rememberMe" className="text-sm crss-muted cursor-pointer">
                  Запомнить меня
                </Label>
              </div>
              <Link 
                to="/auth?mode=forgot"
                className="text-sm crss-link transition-colors"
              >
                Забыли пароль?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full crss-submit"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Войти
            </Button>
          </form>

          <p className="text-sm crss-muted">
            Нет аккаунта?{" "}
            <Link 
              to="/auth?mode=signup"
              className="crss-link transition-colors"
            >
              Зарегистрироваться
            </Link>
          </p>
    </LoginShell>
  );
}
