import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export function DemoBanner() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <Alert className="border-accent/50 bg-accent/10 mb-4 relative">
      <Info className="h-4 w-4 text-accent" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <span className="font-medium text-accent">Демо-режим: </span>
          <span className="text-foreground">
            Вы просматриваете демонстрацию с тестовыми данными. 
            Для полного доступа{" "}
            <Button
              variant="link"
              className="h-auto p-0 text-accent underline"
              onClick={() => navigate("/auth")}
            >
              войдите в систему
            </Button>
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
