Two large initiatives. I'll outline the plan so we agree on scope before I start touching ~30+ files.

## 1. Mobile optimization

### Global (index.css, main layout)
- Switch all `100vh` to `100dvh`, add `viewport-fit=cover` to `index.html`, enable safe-area insets (`env(safe-area-inset-*)`).
- Add iOS input fix: `font-size: 16px` on inputs/selects/textareas at <768px to prevent Safari zoom + scroll jump.
- Lock body horizontal overflow + add `overscroll-behavior: contain` on scroll containers.
- Use `interactive-widget=resizes-content` viewport meta to fix keyboard overlap.
- Increase tap targets to min 44×44 px on mobile (buttons, icon-buttons, table actions).

### Forms (Create/Edit Request, Telegram, etc.)
- Replace Dialog with Drawer on mobile (already partial — extend to EditRequest, Telegram dialogs).
- Add **sticky bottom action bar** inside drawers with Save/Cancel; respects safe-area + keyboard.
- Prevent input refocus jumps: stable keys, no conditional re-mounting on each keystroke.
- Auto-scroll focused input into view above keyboard.

### Tables → Cards on mobile
- RequestsTable: render card layout < md breakpoint (status badge + REQ description + date + executor + amount on top; action buttons larger).
- Same treatment for Shipments, Procurement, Warehouse where applicable (Requests prioritized; others in follow-up).

### Navigation
- Add **bottom navigation bar** on mobile: Заявки · + (Быстрая заявка) · Уведомления · Настройки.
- Hide desktop sidebar on mobile; keep hamburger for full menu.

### Performance
- Audit re-renders in RequestsTable (memoize rows, columns).
- Add `react-window` virtualization for long lists (Requests, Nomenclature, MovementJournal) — only if list >100 rows.
- Debounce search inputs (already 300–400ms in selectors; extend to global search).

## 2. Быстрая заявка (Quick Request)

### Data
- Reuse existing `requests` table. Insert with: `description=<title>`, `status='Новая'`, `created_at=now()`, `created_by=auth.uid()`, `organization_id`, `priority='Средний'` (default), other fields null.
- No migration needed if all other columns are nullable / have defaults. I'll verify and add a tiny migration only if required.

### UI components
- `QuickRequestSheet.tsx` — bottom Drawer/Sheet with two tabs: **Одна** | **Несколько (до 5)**.
  - Single: one input + «Создать». After insert: toast with «Открыть» action.
  - Bulk: 5 input rows, only filled ones submitted. After: list of created with «Открыть» / «Создать ещё».
- `QuickRequestFab.tsx` — floating «+ Быстрая заявка» button, visible on all authed pages (bottom-right above bottom-nav on mobile).
- Global keyboard shortcut `Q` to open on desktop.
- Integrate trigger into the new bottom-nav center «+» button.

### UX details
- Instant insert via `supabase.from('requests').insert(...).select().single()`.
- Autofocus first input; Enter submits single, Enter on bulk moves to next row, Cmd/Ctrl+Enter submits all.
- Optimistic UI — request appears in cache via `queryClient.invalidateQueries(['requests'])`.

## Phasing (so we can ship incrementally)
1. **Phase A — Quick Request** (smaller, high value): QuickRequestSheet + FAB + shortcut. Verify insert works with current schema.
2. **Phase B — Mobile core**: dvh/safe-area/viewport meta, input zoom fix, sticky drawer footer, bottom navigation.
3. **Phase C — Mobile tables**: Requests card view on mobile.
4. **Phase D — Performance**: memoization + virtualization where measured.

Confirm and I'll start with **Phase A + B** in this turn (they're the highest-impact and don't conflict), then continue with C and D.