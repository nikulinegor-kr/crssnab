import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, UserCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Неверный формат email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

const registerSchema = z.object({
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function ClientAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [invitationData, setInvitationData] = useState<{
    email: string;
    name: string;
    token: string;
    organizationId: string;
  } | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for invitation token
    const token = searchParams.get("token");
    if (token) {
      checkInvitation(token);
    }

    // Check if already authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user is a client
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("is_active", true)
          .single();

        if (client) {
          navigate("/client");
        }
      }
    };

    checkAuth();
  }, [searchParams, navigate]);

  const checkInvitation = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from("client_invitations")
        .select("email, name, token, organization_id, expires_at, used_at")
        .eq("token", token)
        .single();

      if (error || !data) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Приглашение не найдено",
        });
        return;
      }

      if (data.used_at) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Приглашение уже использовано",
        });
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Срок действия приглашения истёк",
        });
        return;
      }

      setInvitationData({
        email: data.email,
        name: data.name,
        token: data.token,
        organizationId: data.organization_id,
      });
      setMode("register");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    }
  };

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      // Check if user is a client
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("is_active", true)
          .single();

        if (!client) {
          await supabase.auth.signOut();
          throw new Error("У вас нет доступа к личному кабинету клиента");
        }

        navigate("/client");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onRegister = async (data: RegisterFormData) => {
    if (!invitationData) return;

    setIsLoading(true);
    try {
      // Create user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitationData.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/client`,
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // Create client record
        const { error: clientError } = await supabase
          .from("clients")
          .insert({
            user_id: authData.user.id,
            organization_id: invitationData.organizationId,
            name: invitationData.name,
            email: invitationData.email,
          });

        if (clientError) throw clientError;

        // Mark invitation as used
        await supabase
          .from("client_invitations")
          .update({ used_at: new Date().toISOString() })
          .eq("token", invitationData.token);

        toast({
          title: "Успешно",
          description: "Регистрация завершена. Перенаправление...",
        });

        navigate("/client");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
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
          На главную
        </Button>

        <Card className="glassmorphism border-border/50 shadow-2xl">
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <UserCircle className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black text-foreground">
              {mode === "register" ? "Регистрация клиента" : "Личный кабинет клиента"}
            </CardTitle>
            <CardDescription>
              {mode === "register" 
                ? `Создайте пароль для ${invitationData?.email}`
                : "Войдите для просмотра заявок"
              }
            </CardDescription>
          </CardHeader>

          <CardContent>
            {mode === "register" && invitationData ? (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Имя:</span> {invitationData.name}
                  </p>
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Email:</span> {invitationData.email}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="glassmorphism border-border/50 focus:border-primary"
                    {...registerForm.register("password")}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="glassmorphism border-border/50 focus:border-primary"
                    {...registerForm.register("confirmPassword")}
                  />
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-bold"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Создать аккаунт
                </Button>
              </form>
            ) : (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="password">Пароль</Label>
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
                  className="w-full h-11 text-base font-bold"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Войти
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}