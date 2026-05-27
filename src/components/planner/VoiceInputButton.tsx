import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onResult: (text: string) => void;
  lang?: string;
}

export function VoiceInputButton({ onResult, lang = "ru-RU" }: Props) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => () => recRef.current?.stop?.(), []);

  const toggle = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Голосовой ввод не поддерживается этим браузером", variant: "destructive" });
      return;
    }
    if (listening) {
      recRef.current?.stop?.();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (text) onResult(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      size="icon"
      onClick={toggle}
      title="Голосовой ввод"
    >
      {listening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
