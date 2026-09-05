import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNative } from "./native";

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.readAsDataURL(blob);
  });

const sanitizeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120);

/**
 * Сохраняет файл и открывает системное меню «Поделиться» на iPhone.
 * В браузере возвращает false — вызывающий код скачивает файл как обычно.
 */
export const shareBlobNative = async (blob: Blob, fileName: string, title?: string): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    const safeName = sanitizeFileName(fileName);
    const data = await blobToBase64(blob);
    const written = await Filesystem.writeFile({
      path: safeName,
      data,
      directory: Directory.Cache,
    });
    await Share.share({
      title: title || safeName,
      files: [written.uri],
      dialogTitle: title || safeName,
    });
    return true;
  } catch {
    return false;
  }
};

/** Скачивает файл по ссылке и открывает «Поделиться» (для документов из хранилища). */
export const shareUrlNative = async (url: string, fileName: string): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    return await shareBlobNative(await res.blob(), fileName);
  } catch {
    return false;
  }
};
