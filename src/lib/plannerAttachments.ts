import type { PlannerAttachment } from "@/hooks/usePlannerTasks";

/** Removes only the object selected in the attachment list, even when legacy paths or URLs coincide. */
export function removePlannerAttachment(attachments: PlannerAttachment[], selected: PlannerAttachment): PlannerAttachment[] {
  return attachments.filter((attachment) => attachment !== selected);
}
