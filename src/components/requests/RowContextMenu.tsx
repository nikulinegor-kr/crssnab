import { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { STATUSES, PRIORITIES, getStatusColor, getPriorityColor } from "@/hooks/useRequestsFilters";
import { useRequestParticipants } from "@/hooks/useRequestParticipants";
import { useRequestQuickUpdate } from "./useRequestQuickUpdate";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RowContextMenuProps {
  requestId: string;
  organizationId: string | null;
  requestNumber: string;
  status: string;
  priority: string | null;
  applicant: string | null;
  executor: string | null;
  onOpenCard: () => void;
  children: ReactNode;
}

/** Правый клик по строке: смена статуса, приоритета и людей без открытия панели. */
export const RowContextMenu = ({
  requestId,
  organizationId,
  requestNumber,
  status,
  priority,
  applicant,
  executor,
  onOpenCard,
  children,
}: RowContextMenuProps) => {
  const { update } = useRequestQuickUpdate();
  const { toast } = useToast();
  const { data: applicants = [] } = useRequestParticipants("applicant", organizationId);
  const { data: executors = [] } = useRequestParticipants("executor", organizationId);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52 z-[130]">
        <ContextMenuSub>
          <ContextMenuSubTrigger>Статус</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            {STATUSES.map((option) => (
              <ContextMenuItem
                key={option}
                className={cn(option === status && "font-medium")}
                onSelect={() => void update(requestId, "status", option, status)}
              >
                <span className="mr-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getStatusColor(option) }} />
                {option}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Приоритет</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {PRIORITIES.map((option) => (
              <ContextMenuItem
                key={option}
                className={cn(option === (priority || "Планово") && "font-medium")}
                onSelect={() => void update(requestId, "priority", option, priority)}
              >
                <span className="mr-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getPriorityColor(option) }} />
                {option}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Заявитель</ContextMenuSubTrigger>
          <ContextMenuSubContent className="max-h-[320px] w-56 overflow-y-auto">
            <ContextMenuItem onSelect={() => void update(requestId, "applicant", null, applicant)}>
              <span className="italic text-muted-foreground">Снять назначение</span>
            </ContextMenuItem>
            {applicants.map((person) => (
              <ContextMenuItem
                key={person.id}
                className={cn(person.name === applicant && "font-medium")}
                onSelect={() => void update(requestId, "applicant", person.name, applicant)}
              >
                {person.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Кто ведёт</ContextMenuSubTrigger>
          <ContextMenuSubContent className="max-h-[320px] w-56 overflow-y-auto">
            <ContextMenuItem onSelect={() => void update(requestId, "executor", null, executor)}>
              <span className="italic text-muted-foreground">Снять назначение</span>
            </ContextMenuItem>
            {executors.map((person) => (
              <ContextMenuItem
                key={person.id}
                className={cn(person.name === executor && "font-medium")}
                onSelect={() => void update(requestId, "executor", person.name, executor)}
              >
                {person.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onOpenCard}>Открыть карточку</ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            navigator.clipboard.writeText(requestNumber);
            toast({ title: "Номер скопирован", description: requestNumber });
          }}
        >
          Копировать номер
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
