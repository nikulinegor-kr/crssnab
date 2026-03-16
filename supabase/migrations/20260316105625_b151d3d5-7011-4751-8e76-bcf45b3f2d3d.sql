-- For each existing material_object that lacks a general_docs folder, create one
INSERT INTO public.material_folders (organization_id, object_id, name, sort_order, type)
SELECT mo.organization_id, mo.id, 'Общие документы', 0, 'general_docs'
FROM public.material_objects mo
WHERE NOT EXISTS (
  SELECT 1 FROM public.material_folders mf
  WHERE mf.object_id = mo.id AND mf.type = 'general_docs'
);

-- For each existing material_object that lacks a materials folder, create one
INSERT INTO public.material_folders (organization_id, object_id, name, sort_order, type)
SELECT mo.organization_id, mo.id, 'Работы и материалы', 1, 'materials'
FROM public.material_objects mo
WHERE NOT EXISTS (
  SELECT 1 FROM public.material_folders mf
  WHERE mf.object_id = mo.id AND mf.type = 'materials'
);

-- Move existing files that have no folder or belong to old folders into the "materials" folder
UPDATE public.material_statements ms
SET folder_id = (
  SELECT mf.id FROM public.material_folders mf
  WHERE mf.object_id = ms.object_id AND mf.type = 'materials'
  LIMIT 1
)
WHERE ms.folder_id IS NULL
  OR ms.folder_id NOT IN (
    SELECT id FROM public.material_folders WHERE type IN ('general_docs', 'materials')
  );