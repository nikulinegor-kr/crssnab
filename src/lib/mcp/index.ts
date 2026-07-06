import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRequestsTool from "./tools/list-requests";
import getRequestTool from "./tools/get-request";
import listMyPlannerTasksTool from "./tools/list-my-planner-tasks";
import createPlannerTaskTool from "./tools/create-planner-task";
import listObjectsTool from "./tools/list-objects";

// Build the OAuth issuer from the Supabase project ref. VITE_SUPABASE_PROJECT_ID is
// inlined by Vite at build time, so this stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "crss-snab-mcp",
  title: "CRSS Снаб — Agent Integration",
  version: "0.1.0",
  instructions:
    "Инструменты CRSS Снаб для AI-ассистентов. Используйте list_requests / get_request для работы с заявками снабжения, list_objects для контекста объектов, list_my_planner_tasks и create_planner_task — для персонального планировщика текущего пользователя. Все операции выполняются от имени залогиненного пользователя и уважают его права доступа.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listRequestsTool,
    getRequestTool,
    listObjectsTool,
    listMyPlannerTasksTool,
    createPlannerTaskTool,
  ],
});
