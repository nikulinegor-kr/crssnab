import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlannerTaskDialog } from "./PlannerTaskDialog";

export function PlannerQuickFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 h-14 w-14 rounded-full shadow-lg z-40 md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Новая задача"
      >
        <Plus className="h-6 w-6" />
      </Button>
      <PlannerTaskDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
