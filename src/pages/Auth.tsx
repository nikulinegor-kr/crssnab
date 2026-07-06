import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

// Only allow same-origin relative paths as `next` to prevent open-redirects.
function safeNext(raw: string | null): string {
  if (!raw) return "/select-organization";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/select-organization";
  return raw;
}

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.location.href = next;
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = next;
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, next]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      organizationName: "",
      inn: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onLogin = async (data: LoginFormData) => {
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
      const isNetworkError = error.message === "Failed to fetch" || error.message?.includes("fetch") || error.message === "Load failed" || error.message?.includes("NetworkError") || error.message?.includes("network") || error.name === "TypeError";
      let errorMessage = error.message || "Не удалось войти";
      if (isNetworkError) {
        errorMessage = "Ошибка сети. Проверьте подключение к интернету или попробуйте отключить VPN.";
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
            onClick={() => loginForm.handleSubmit(onLogin)()}
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

  const onSignup = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const { error: signUpError, data: authData } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            organization_name: data.organizationName,
            inn: data.inn,
            phone: data.phone,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        toast({
          title: "Успешно",
          description: "Регистрация завершена. Перенаправление...",
        });
      }
    } catch (error: any) {
      const isNetworkError = error.message === "Failed to fetch" || error.message?.includes("fetch") || error.message === "Load failed" || error.message?.includes("NetworkError") || error.message?.includes("network") || error.name === "TypeError";
      let errorMessage = error.message || "Не удалось зарегистрироваться";
      if (isNetworkError) {
        errorMessage = "Ошибка сети. Проверьте подключение к интернету или попробуйте отключить VPN.";
      } else if (error.message?.includes("already registered")) {
        errorMessage = "Пользователь с таким email уже зарегистрирован";
      }
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: errorMessage,
        action: isNetworkError ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => signupForm.handleSubmit(onSignup)()}
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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"></div>
      
      <div className="w-full max-w-md relative">
        <Button
          variant="ghost"
          className="mb-6 hover:bg-secondary/80"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Вернуться на главную
        </Button>

        <Card className="glassmorphism border-border/50 shadow-2xl">
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <img src="/logo.png" alt="CRSS" className="h-8 w-8 object-contain" />
              <span className="text-2xl font-bold text-foreground">CRSS</span>
            </div>
            <CardTitle className="text-2xl font-black text-foreground">
              Добро пожаловать
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Войдите или создайте новый аккаунт
            </p>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 glassmorphism">
                <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Вход
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Регистрация
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4 animate-fade-in">
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      className="glassmorphism border-border/50 focus:border-primary"
                      {...loginForm.register("email")}
                    />
                    {loginForm.formState.errors.email && (
                      <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground">Пароль</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="glassmorphism border-border/50 focus:border-primary"
                      {...loginForm.register("password")}
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 text-base font-bold hover-scale"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Войти
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 animate-fade-in">
                <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-foreground">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      className="glassmorphism border-border/50 focus:border-primary"
                      {...signupForm.register("email")}
                    />
                    {signupForm.formState.errors.email && (
                      <p className="text-xs text-destructive">{signupForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organizationName" className="text-foreground">Название организации</Label>
                    <Input
                      id="organizationName"
                      placeholder="ООО Компания"
                      className="glassmorphism border-border/50 focus:border-primary"
                      {...signupForm.register("organizationName")}
                    />
                    {signupForm.formState.errors.organizationName && (
                      <p className="text-xs text-destructive">{signupForm.formState.errors.organizationName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inn" className="text-foreground">ИНН</Label>
                    <Input
                      id="inn"
                      placeholder="1234567890"
                      className="glassmorphism border-border/50 focus:border-primary"
                      {...signupForm.register("inn")}
                    />
                    {signupForm.formState.errors.inn && (
                      <p className="text-xs text-destructive">{signupForm.formState.errors.inn.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground">Телефон</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+7 (999) 123-45-67"
                      className="glassmorphism border-border/50 focus:border-primary"
                      {...signupForm.register("phone")}
                    />
                    {signupForm.formState.errors.phone && (
                      <p className="text-xs text-destructive">{signupForm.formState.errors.phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-foreground">Пароль</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      className="glassmorphism border-border/50 focus:border-primary"
                      {...signupForm.register("password")}
                    />
                    {signupForm.formState.errors.password && (
                      <p className="text-xs text-destructive">{signupForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-foreground">Подтвердите пароль</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      className="glassmorphism border-border/50 focus:border-primary"
                      {...signupForm.register("confirmPassword")}
                    />
                    {signupForm.formState.errors.confirmPassword && (
                      <p className="text-xs text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 text-base font-bold hover-scale"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Создать аккаунт
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
