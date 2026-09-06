import { useState } from "react";
import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useDeletePlannerTask,
  useUpdatePlannerTask,
  type PlannerTask,
} from "@/hooks/usePlannerTasks";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  task: PlannerTask;
  className?: string;
}

/** Quick actions for a planner task: archive / restore / delete. */
export function PlannerTaskActions({ task, className }: Props) {
  const update = useUpdatePlannerTask();
  const del = useDeletePlannerTask();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const archived = !!task.archived_at;

  const toggleArchive = async () => {
    try {
      await update.mutateAsync({
        id: task.id,
        patch: { archived_at: archived ? null : new Date().toISOString() } as any,
      });
      toast({ title: archived ? "Задача возвращена из архива" : "Задача в архиве" });
    } catch {
      /* handled by mutation onError */
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Действия с задачей"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "h-6 w-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition-opacity",
              className
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={toggleArchive}>
            {archived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" /> Вернуть из архива
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> В архив
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              «{task.title}» будет удалена безвозвратно. Если задача может понадобиться — лучше отправить её в архив.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => del.mutate(task.id)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
