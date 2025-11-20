import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ChatAttachmentProps {
  attachment: {
    id: string;
    file_name: string;
    file_url: string;
    file_type: string;
    file_size: number;
  };
  isOwnMessage: boolean;
}

export function ChatAttachment({ attachment, isOwnMessage }: ChatAttachmentProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isLegacyUrl = attachment.file_url.startsWith('http');

  useEffect(() => {
    if (isLegacyUrl) {
      setSignedUrl(attachment.file_url);
      setLoading(false);
    } else {
      // Fetch signed URL for private bucket files
      const fetchSignedUrl = async () => {
        const { data, error } = await supabase.storage
          .from('chat-files')
          .createSignedUrl(attachment.file_url, 3600); // 1 hour

        if (error) {
          console.error('Error creating signed URL:', error);
          setLoading(false);
          return;
        }

        setSignedUrl(data.signedUrl);
        setLoading(false);
      };

      fetchSignedUrl();
    }
  }, [attachment.file_url, isLegacyUrl]);

  const handleClick = async (e: React.MouseEvent) => {
    if (loading) {
      e.preventDefault();
      return;
    }

    if (!signedUrl) {
      e.preventDefault();
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить файл",
        variant: "destructive",
      });
    }
  };

  return (
    <a
      href={signedUrl || '#'}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 p-2 rounded ${
        isOwnMessage ? "bg-primary-foreground/10" : "bg-background"
      } hover:opacity-80 transition-opacity cursor-pointer`}
    >
      {loading ? (
        <div className="text-xs opacity-70">Загрузка...</div>
      ) : attachment.file_type.startsWith('image/') ? (
        <img 
          src={signedUrl || ''} 
          alt={attachment.file_name}
          className="max-w-full max-h-48 rounded"
        />
      ) : (
        <>
          <Download className="h-4 w-4" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{attachment.file_name}</div>
            <div className="text-xs opacity-70">
              {(attachment.file_size / 1024).toFixed(1)} КБ
            </div>
          </div>
        </>
      )}
    </a>
  );
}
