import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BrandingSettingsProps {
  organizationId: string;
}

export const BrandingSettings = ({ organizationId }: BrandingSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1A1F2C");
  const [secondaryColor, setSecondaryColor] = useState("#9b87f5");

  useEffect(() => {
    loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("organizations")
        .select("logo_url, primary_color, secondary_color")
        .eq("id", organizationId)
        .single();

      if (error) throw error;

      if (data) {
        setLogoUrl(data.logo_url || "");
        setPrimaryColor(data.primary_color || "#1A1F2C");
        setSecondaryColor(data.secondary_color || "#9b87f5");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить настройки",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("organizations")
        .update({
          logo_url: logoUrl,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
        })
        .eq("id", organizationId);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Настройки брендинга сохранены",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <CardTitle>Брендинг</CardTitle>
        </div>
        <CardDescription>
          Настройте внешний вид системы под ваш бренд
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="logo">Логотип организации</Label>
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img 
                src={logoUrl} 
                alt="Logo" 
                className="h-16 w-16 object-contain rounded border border-border"
              />
            )}
            <div className="flex-1">
              <Input
                id="logo"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Вставьте URL изображения логотипа
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary">Основной цвет</Label>
            <div className="flex gap-2">
              <Input
                id="primary"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-20 h-10 p-1 cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#1A1F2C"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondary">Дополнительный цвет</Label>
            <div className="flex gap-2">
              <Input
                id="secondary"
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-20 h-10 p-1 cursor-pointer"
              />
              <Input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="#9b87f5"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/50">
          <div 
            className="w-12 h-12 rounded-full" 
            style={{ backgroundColor: primaryColor }}
          />
          <div 
            className="w-12 h-12 rounded-full" 
            style={{ backgroundColor: secondaryColor }}
          />
          <p className="text-sm text-muted-foreground">
            Предварительный просмотр выбранных цветов
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Сохранить изменения
        </Button>
      </CardContent>
    </Card>
  );
};
