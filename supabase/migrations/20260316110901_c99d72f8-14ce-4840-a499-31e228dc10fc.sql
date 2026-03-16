
-- Step 1: For each material_folder that is NOT "Общие документы" (type != 'general_docs'),
-- convert it into a material_section, then create two sub-folders.

-- Create new sections from existing folders (excluding general_docs)
INSERT INTO public.material_sections (id, object_id, organization_id, name, sort_order, created_at)
SELECT 
  gen_random_uuid(),
  mf.object_id,
  mf.organization_id,
  mf.name,
  mf.sort_order,
  mf.created_at
FROM public.material_folders mf
WHERE mf.type = 'materials'
  AND mf.section_id IS NOT NULL
  -- Exclude if a section with the same name already exists for this object
  AND NOT EXISTS (
    SELECT 1 FROM public.material_sections ms2
    WHERE ms2.object_id = mf.object_id AND ms2.name = mf.name
  );

-- Step 2: Create "Общие документы" and "Работы и материалы" folders for each NEW section
-- (sections that don't yet have these folders)
INSERT INTO public.material_folders (id, object_id, section_id, organization_id, name, sort_order, type)
SELECT 
  gen_random_uuid(),
  ms.object_id,
  ms.id,
  ms.organization_id,
  'Общие документы',
  0,
  'general_docs'
FROM public.material_sections ms
WHERE ms.name != 'Основной раздел'
  AND NOT EXISTS (
    SELECT 1 FROM public.material_folders mf2
    WHERE mf2.section_id = ms.id AND mf2.type = 'general_docs'
  );

INSERT INTO public.material_folders (id, object_id, section_id, organization_id, name, sort_order, type)
SELECT 
  gen_random_uuid(),
  ms.object_id,
  ms.id,
  ms.organization_id,
  'Работы и материалы',
  1,
  'materials'
FROM public.material_sections ms
WHERE ms.name != 'Основной раздел'
  AND NOT EXISTS (
    SELECT 1 FROM public.material_folders mf2
    WHERE mf2.section_id = ms.id AND mf2.type = 'materials'
  );

-- Step 3: Move files from old folders to the new "Работы и материалы" folders
-- Match by folder name -> section name
UPDATE public.material_statements ms_stmt
SET folder_id = new_folder.id,
    section_id = new_section.id
FROM public.material_folders old_folder,
     public.material_sections new_section,
     public.material_folders new_folder
WHERE ms_stmt.folder_id = old_folder.id
  AND old_folder.type = 'materials'
  AND old_folder.section_id = (SELECT id FROM public.material_sections WHERE name = 'Основной раздел' AND object_id = old_folder.object_id LIMIT 1)
  AND new_section.object_id = old_folder.object_id
  AND new_section.name = old_folder.name
  AND new_section.name != 'Основной раздел'
  AND new_folder.section_id = new_section.id
  AND new_folder.type = 'materials';

-- Step 4: Delete old folders that belonged to "Основной раздел"
DELETE FROM public.material_folders
WHERE section_id IN (
  SELECT id FROM public.material_sections WHERE name = 'Основной раздел'
);

-- Step 5: Delete "Основной раздел" sections
DELETE FROM public.material_sections WHERE name = 'Основной раздел';
