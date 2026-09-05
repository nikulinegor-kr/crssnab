import { useCallback } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { isNative } from "@/lib/native";

const dataUrlToFile = async (dataUrl: string, name: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
};

/**
 * Съёмка фото / выбор из галереи в мобильном приложении.
 * Возвращает обычный File — совместимо с текущими загрузчиками файлов.
 * В браузере возвращает null, интерфейс использует стандартный input[type=file].
 */
export const useNativeCamera = () => {
  const capture = useCallback(async (source: "camera" | "photos" = "camera"): Promise<File | null> => {
    if (!isNative()) return null;
    try {
      const photo = await Camera.getPhoto({
        quality: 82,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
        promptLabelHeader: "Фото",
        promptLabelPhoto: "Выбрать из галереи",
        promptLabelPicture: "Сделать снимок",
        promptLabelCancel: "Отмена",
      });
      if (!photo.dataUrl) return null;
      const ext = photo.format || "jpeg";
      return await dataUrlToFile(photo.dataUrl, `photo-${Date.now()}.${ext}`);
    } catch {
      return null;
    }
  }, []);

  const pickMultiple = useCallback(async (limit = 10): Promise<File[]> => {
    if (!isNative()) return [];
    try {
      const result = await Camera.pickImages({ quality: 82, limit });
      const files: File[] = [];
      for (const [i, p] of (result.photos ?? []).entries()) {
        if (!p.webPath) continue;
        const res = await fetch(p.webPath);
        const blob = await res.blob();
        files.push(new File([blob], `photo-${Date.now()}-${i}.${p.format || "jpg"}`, {
          type: blob.type || "image/jpeg",
        }));
      }
      return files;
    } catch {
      return [];
    }
  }, []);

  return { isNativeApp: isNative(), capture, pickMultiple };
};
