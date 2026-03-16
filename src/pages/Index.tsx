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
import { Loader2, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

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
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

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
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Side - Logo */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
        <div className="flex flex-col items-center text-center gap-4">
          <img 
            src="/logo.png" 
            alt="CRSS Logo" 
            className="h-36 w-auto"
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-5xl font-bold text-foreground tracking-wide">CRSS</h1>
            <p className="text-lg text-muted-foreground leading-tight">
              Система управления заявками
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center justify-center mb-8">
            <img 
              src="/logo.png" 
              alt="CRSS Logo" 
              className="h-16 w-auto"
            />
          </div>

          {/* Role Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
            <div
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-background shadow-sm text-foreground text-sm font-medium cursor-default"
            >
              <Sun className="h-4 w-4 text-primary" />
              Администратор
            </div>
            <Link
              to="/employee-login"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-muted-foreground text-sm font-medium hover:text-foreground transition-colors"
            >
              <Users className="h-4 w-4" />
              Сотрудник
            </Link>
          </div>

          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-foreground">Вход для администратора</h2>
            <p className="text-xs text-muted-foreground">
              Введите данные для доступа к панели управления
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-foreground text-xs font-extralight">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                className="h-10 text-sm bg-background border-border focus:border-primary"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-foreground text-xs font-extralight">
                Пароль
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-10 text-sm bg-background border-border focus:border-primary pr-10"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                <Label htmlFor="rememberMe" className="text-xs text-muted-foreground cursor-pointer font-extralight">
                  Запомнить меня
                </Label>
              </div>
              <Link 
                to="/auth" 
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Забыли пароль?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-sm font-medium bg-primary hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Войти
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">
            Нет аккаунта?{" "}
            <Link 
              to="/auth" 
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
