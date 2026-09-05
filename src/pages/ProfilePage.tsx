import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import BiometricSettingCard from "@/components/native/BiometricSettingCard";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    position: "",
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        const fullName = profileData.full_name?.split(" ") || ["", ""];
        setProfile({
          firstName: fullName[0] || "",
          lastName: fullName[1] || "",
          email: profileData.email || "",
          phone: "",
          position: profileData.position || "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: `${profile.firstName} ${profile.lastName}`.trim(),
          position: profile.position,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Профиль обновлен",
        description: "Ваши данные успешно сохранены",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Пароль изменен",
        description: "Ваш пароль успешно обновлен",
      });

      setPasswords({ currentPassword: "", newPassword: "" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="w-full max-w-5xl mx-auto p-3 sm:p-4 md:p-6 space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Профиль пользователя
        </h1>
        <p className="text-sm text-muted-foreground">
          Просмотр и редактирование личной информации и настроек
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка - аватар и основная информация */}
          <div className="space-y-6">
            <Card className="bg-card border-border/40">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <Avatar className="h-32 w-32">
                  <AvatarFallback className="text-3xl bg-primary/20 text-primary">
                    {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {profile.firstName} {profile.lastName}
                  </h2>
                  <p className="text-sm text-primary">{profile.email}</p>
                  <p className="text-sm text-muted-foreground mt-1">{profile.position}</p>
                </div>
                <Button
                  variant="ghost"
                  className="text-primary hover:text-primary/80"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Выйти из аккаунта
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Правая колонка - формы */}
          <div className="lg:col-span-2 space-y-6">
            {/* Личные данные */}
            <Card className="bg-card border-border/40">
              <CardHeader className="border-b border-border/40">
                <CardTitle className="text-lg">Личные данные</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Имя</Label>
                      <Input
                        id="firstName"
                        placeholder="Иван"
                        value={profile.firstName}
                        onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Фамилия</Label>
                      <Input
                        id="lastName"
                        placeholder="Иванов"
                        value={profile.lastName}
                        onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="ivan.ivanov@crss.corp"
                        value={profile.email}
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Телефон</Label>
                      <Input
                        id="phone"
                        placeholder="+7 (999) 123-45-67"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline">
                      Отменить
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Сохранение..." : "Сохранить изменения"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Безопасность */}
            <Card className="bg-card border-border/40">
              <CardHeader className="border-b border-border/40">
                <CardTitle className="text-lg">Безопасность</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Текущий пароль</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="••••••••"
                      value={passwords.currentPassword}
                      onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Новый пароль</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="twoFactor">Двухфакторная аутентификация</Label>
                      <p className="text-sm text-muted-foreground">
                        Дополнительный уровень безопасности
                      </p>
                    </div>
                    <Switch
                      id="twoFactor"
                      checked={twoFactorEnabled}
                      onCheckedChange={setTwoFactorEnabled}
                    />
                  </div>

                  <BiometricSettingCard />


                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline">
                      Отменить
                    </Button>
                    <Button type="submit" disabled={loading || !passwords.newPassword}>
                      {loading ? "Сохранение..." : "Сохранить изменения"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
