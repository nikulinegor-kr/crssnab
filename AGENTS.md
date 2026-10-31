# Project Architecture Rules

- Keep request staleness logic in `src/lib/requestStaleness.ts` so counters, filters, and row indicators cannot diverge.
- Keep dashboard operational queues in dedicated widgets fed by the unfiltered request list so period controls do not alter actionable totals.
- Keep executive-panel queries organization-scoped and independent in `useExecutivePanel`, with exact head-only counts and paginated aggregate rows; reuse the planner task dialog for drill-down to avoid inconsistent editing behavior.
- Keep the shared closed-request status list in `requestStaleness.ts`; executive aggregates use it without changing existing staleness predicates.
- Keep planner status normalization and labels in a pure shared module, re-exported by usePlannerTasks, so compatibility mappings can be tested without browser dependencies.
- Enforce planner transitions and activity reasons in database triggers; preserve notification logic and use the existing user-first organization access function signatures.
- Keep /tasks server-filtered and paginated over planner_tasks with pure taskHub tab/action logic; reuse PlannerTaskDialog and enforce collaborator visibility through RLS rather than client-side filtering.
- Keep executive drill-down links in executivePanel.ts and delivery/open predicates in requestStaleness.ts; URL drill-down filters are temporary and restore saved user filters to keep counts and lists identical.

- Keep home-screen installability manifest-only; the existing notification worker remains messaging-only without app-shell caching so previews and fresh releases are not trapped in offline caches.

- Scope personal-cabinet queries explicitly to auth user and reuse PlannerTaskDialog, TaskStatusActions and ProfilePage so personal views never fork task or profile editing.
- Verify push-hook headers through a service-role-only boolean RPC against private DB config; rotate the DB value without returning it, avoiding shared secret literals and environment synchronization.
- Keep notification links normalized in a pure client helper and the messaging worker, and suppress local browser notifications when a real Web Push subscription exists to avoid duplicate delivery.
- Share the public VAPID key from the edge shared config through Vite's VITE_VAPID_PUBLIC_KEY define so browser subscriptions and server signing use the same key; private credentials remain secret-store-only.
- Use the pure pluralRu helper for Russian count labels so executive summaries and object rows share the same declension rules.
- Keep direct Anthropic calls and model selection in functions/_shared/claude.ts; request-assistant tools use only the authenticated user's RLS client and return proposals without business-data writes.
- Store request-assistant history in existing AI conversations titled by request number; task proposals use the existing planner mutation only after user confirmation and the shared dialog for edits.
- Keep trust-letter templates and completed files in separate private buckets; browser rendering uses shared pure grouping/validation, and a permission-checked transactional RPC alone finalizes numbers, attachments and activities to prevent partial journals.
- Parse attached invoices through the authenticated Claude assistant and its user-token storage client; persist extraction caches and verified supplier directors separately from read-only chat tools.
- Expose request receiving and stock moves/issues through receive_warehouse_request and simple_warehouse_operation; both atomically reuse post_warehouse_document internally, keeping draft documents hidden and stock read-only to clients. Receipt is open to any active org member who can view the request; moves/issues and warehouse management stay behind user_can_use_qr_warehouse.
- Keep receipt UI only in RequestReceiptButton in the side panel; use shared LabelExporter and local canvas PNG generation for receipt and TMC reprinting so permanent IDs and export behavior never diverge.
- Keep semantic label wrapping in the pure labelText helper and fit whole groups in the canvas renderer so previews, PNG exports and reprints use identical break rules.
- Route every user-facing "save this image/file" action through src/lib/saveImage.ts so touch devices get the system share sheet (Save to Photos) and desktops get a real file download, instead of per-screen download code that silently fails on iPhone.
- Store fallback receipts against the source request without inventing request_items; lock requests and record confirmed lines atomically so concurrent retries cannot change quantities or duplicate stock.
- Open receipt UI only after a successful delivered-status save; synchronize the selected request with refreshed request data so the side panel never keeps a stale status.
- Serve the warehouse directory and warehouse-scoped TMC balances at /warehouse and its /warehouse/qr alias; retain /warehouse/legacy separately and never combine its legacy movements with warehouse_balances to avoid double counting.
- Store optional warehouse contact details in the existing description field with a versioned encoding, preserving legacy free text; use the explicit warehouses_object_id_fkey for object embeds to avoid ambiguous reverse relationships.
- Derive request QR links from the existing immutable primary UUID, using RequestQrButton and LabelExporter; keep request links distinct from permanent individual TMC QR tokens so no backfill or duplicate identifiers are needed.
- Show object issues only from posted warehouse_issues via the pure objectIssues helper in one shared ObjectIssuesView (warehouse tab and object card), grouping by stable unit id and never merging units.
- Reuse the warehouse form for create/edit; guard deletion on the server by inspecting incoming foreign keys so cascade and set-null cannot erase inventory history or request links.
