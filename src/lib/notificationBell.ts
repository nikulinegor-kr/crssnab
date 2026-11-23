export const REQUEST_ARRIVED_NOTIFICATION = "request_arrived";
export const TASK_ASSIGNED_NOTIFICATION = "task_assigned";

const legacyAssignment = 'and(type.eq.planner_task,title.eq."🔔 Вам назначена задача")';

export const NOTIFICATION_BELL_READ_FILTER = `type.eq.${REQUEST_ARRIVED_NOTIFICATION},${legacyAssignment}`;
export const NOTIFICATION_BELL_FILTER = `type.eq.${TASK_ASSIGNED_NOTIFICATION},${NOTIFICATION_BELL_READ_FILTER}`;
