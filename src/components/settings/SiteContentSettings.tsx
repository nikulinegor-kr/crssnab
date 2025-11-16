import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";

interface SiteContentSettingsProps {
  organizationId: string;
}

export const SiteContentSettings = ({ organizationId }: SiteContentSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Hero section state
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroCTAPrimary, setHeroCTAPrimary] = useState("");
  const [heroCTASecondary, setHeroCTASecondary] = useState("");

  useEffect(() => {
    loadContent();
  }, [organizationId]);

  const loadContent = async () => {
    try {
      const { data, error } = await supabase
        .from("site_content")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("section", "hero")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data && data.content) {
        const content = data.content as any;
        setHeroTitle(content.title || "");
        setHeroSubtitle(content.subtitle || "");
        setHeroCTAPrimary(content.cta_primary || "");
        setHeroCTASecondary(content.cta_secondary || "");
      }
    } catch (error: any) {
      console.error("Error loading site content:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить контент сайта",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const content = {
        title: heroTitle,
        subtitle: heroSubtitle,
        cta_primary: heroCTAPrimary,
        cta_secondary: heroCTASecondary,
      };

      const { error } = await supabase
        .from("site_content")
        .upsert({
          organization_id: organizationId,
          section: "hero",
          content: content,
          is_active: true,
        }, {
          onConflict: "organization_id,section"
        });

      if (error) throw error;

      toast({
        title: "Сохранено",
        description: "Контент сайта успешно обновлен",
      });
    } catch (error: any) {
      console.error("Error saving site content:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить изменения",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Главная секция (Hero)</CardTitle>
          <CardDescription>
            Настройте заголовок и текст на главной странице сайта
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hero-title">Заголовок</Label>
            <Input
              id="hero-title"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              placeholder="Система управления заявками для вашего бизнеса"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero-subtitle">Подзаголовок</Label>
            <Textarea
              id="hero-subtitle"
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Оптимизируйте процессы..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cta-primary">Текст основной кнопки</Label>
              <Input
                id="cta-primary"
                value={heroCTAPrimary}
                onChange={(e) => setHeroCTAPrimary(e.target.value)}
                placeholder="Попробовать бесплатно"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta-secondary">Текст дополнительной кнопки</Label>
              <Input
                id="cta-secondary"
                value={heroCTASecondary}
                onChange={(e) => setHeroCTASecondary(e.target.value)}
                placeholder="Демо-версия"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Сохранить изменения
            </>
          )}
        </Button>
      </div>
    </div>
  );
};