
ALTER TABLE public.max_groups
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_api_status INTEGER,
  ADD COLUMN IF NOT EXISTS last_api_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_discovered BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chat_type TEXT;

ALTER TABLE public.max_groups ALTER COLUMN organization_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS max_groups_group_id_unique_when_unassigned
  ON public.max_groups (group_id) WHERE organization_id IS NULL;

-- Allow any authenticated user to view discovered (unassigned) groups so admins can claim them
DROP POLICY IF EXISTS "Authenticated can view discovered max groups" ON public.max_groups;
CREATE POLICY "Authenticated can view discovered max groups"
  ON public.max_groups FOR SELECT
  TO authenticated
  USING (organization_id IS NULL);

-- Allow org admins to claim a discovered group by assigning organization_id
DROP POLICY IF EXISTS "Admins can claim discovered max groups" ON public.max_groups;
CREATE POLICY "Admins can claim discovered max groups"
  ON public.max_groups FOR UPDATE
  TO authenticated
  USING (organization_id IS NULL)
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));
