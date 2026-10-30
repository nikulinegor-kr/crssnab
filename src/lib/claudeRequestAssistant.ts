import type { PlannerTaskPriority } from "@/hooks/usePlannerTasks";
export type TaskProposal = { type: "create_task"; title: string; description: string; assignee_id: string | null; due_date: string | null; priority: PlannerTaskPriority };
export type AssistantReply = { text: string; proposals: TaskProposal[]; usage: { input_tokens: number; output_tokens: number }; conversation_id: string };
export function confirmedProposalInput(proposal: TaskProposal, requestId: string, confirmed: boolean) {
  if (!confirmed) return null;
  return { title: proposal.title, description: proposal.description, assignee_id: proposal.assignee_id, due_date: proposal.due_date, priority: proposal.priority, request_id: requestId, status: "backlog" as const };
}
