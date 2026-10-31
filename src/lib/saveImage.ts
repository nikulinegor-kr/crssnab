import { isNative } from './native';
import { shareBlobNative } from './nativeShare';

export type ImageSaveMethod = 'native' | 'share' | 'download';

/**
 * Где сохранять картинку:
 * - native — внутри собранного приложения: системное «Поделиться» (там «Сохранить изображение»);
 * - share — телефон/планшет в браузере: «Поделиться» даёт «Сохранить в «Фото»»;
 * - download — компьютер: обычное сохранение файла в папку «Загрузки».
 */
export function chooseImageSaveMethod(env: { native: boolean; touch: boolean; canShareFiles: boolean }): ImageSaveMethod {
  if (env.native) return 'native';
  if (env.touch && env.canShareFiles) return 'share';
  return 'download';
}

export function canShareImageFile(file?: File | null): boolean {
  if (!file) return false;
  try {
    return typeof navigator.share === 'function' && (navigator.canShare?.({ files: [file] }) ?? false);
  } catch {
    return false;
  }
}

export function detectImageSaveMethod(file?: File | null): ImageSaveMethod {
  let touch = false;
  try {
    touch = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)').matches : (navigator.maxTouchPoints ?? 0) > 0;
  } catch {
    touch = (navigator.maxTouchPoints ?? 0) > 0;
  }
  return chooseImageSaveMethod({ native: isNative(), touch, canShareFiles: canShareImageFile(file) });
}

/** Сохранение файла-картинки: на iPhone — в «Фото» через системное меню, на компьютере — в папку загрузок. */
export async function saveImageFile(file: File, title: string): Promise<void> {
  const method = detectImageSaveMethod(file);
  if (method === 'native') {
    if (await shareBlobNative(file, file.name, title)) return;
  }
  if (method === 'share') {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
  }
  downloadBlob(file, file.name);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
