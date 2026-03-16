-- 1. Create material_sections table
CREATE TABLE public.material_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL REFERENCES public.material_objects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_sections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view org sections" ON public.material_sections FOR SELECT TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can create org sections" ON public.material_sections FOR INSERT TO authenticated
  WITH CHECK (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can update org sections" ON public.material_sections FOR UPDATE TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can delete org sections" ON public.material_sections FOR DELETE TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

-- 2. Add section_id to material_folders
ALTER TABLE public.material_folders ADD COLUMN section_id uuid REFERENCES public.material_sections(id) ON DELETE CASCADE;

-- 3. Add section_id to material_statements
ALTER TABLE public.material_statements ADD COLUMN section_id uuid REFERENCES public.material_sections(id) ON DELETE SET NULL;

-- 4. Migrate existing folders that are old-style (not the auto-generated ones) into sections
-- First, find all unique "old folders" - those that have files but aren't the global general_docs/materials
-- We'll convert ALL existing folders into sections, then create proper sub-folders

-- Create sections from existing distinct folder names per object (excluding the auto-created ones)
-- Since we don't know which are "sections" vs "auto folders", let's create a default section for each object
INSERT INTO public.material_sections (object_id, organization_id, name, sort_order)
SELECT DISTINCT mo.id, mo.organization_id, 'Основной раздел', 0
FROM public.material_objects mo
WHERE NOT EXISTS (
  SELECT 1 FROM public.material_sections ms WHERE ms.object_id = mo.id
);

-- 5. Link existing general_docs and materials folders to their object's section
UPDATE public.material_folders mf
SET section_id = (
  SELECT ms.id FROM public.material_sections ms
  WHERE ms.object_id = mf.object_id
  LIMIT 1
)
WHERE mf.section_id IS NULL;

-- 6. Link existing statements to sections via their folder
UPDATE public.material_statements ms
SET section_id = (
  SELECT mf2.section_id FROM public.material_folders mf2
  WHERE mf2.id = ms.folder_id
  LIMIT 1
)
WHERE ms.folder_id IS NOT NULL AND ms.section_id IS NULL;

-- 7. For statements with no folder, assign to the object's first section and first materials folder
UPDATE public.material_statements ms
SET section_id = (
  SELECT sec.id FROM public.material_sections sec
  WHERE sec.object_id = ms.object_id
  LIMIT 1
),
folder_id = (
  SELECT mf.id FROM public.material_folders mf
  JOIN public.material_sections sec ON mf.section_id = sec.id
  WHERE sec.object_id = ms.object_id AND mf.type = 'materials'
  LIMIT 1
)
WHERE ms.folder_id IS NULL AND ms.object_id IS NOT NULL;