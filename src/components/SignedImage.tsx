import { ImgHTMLAttributes } from "react";
import { useSignedUrl } from "@/lib/storageUrl";

interface SignedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  expiresIn?: number;
}

/**
 * <img> wrapper that resolves a Supabase Storage URL (public or stored)
 * to a fresh signed URL before rendering.
 */
export function SignedImage({ src, expiresIn, alt = "", ...rest }: SignedImageProps) {
  const signed = useSignedUrl(src, expiresIn);
  if (!signed) return null;
  return <img src={signed} alt={alt} {...rest} />;
}
