ALTER TABLE public.material_folders ADD COLUMN type text NOT NULL DEFAULT 'materials';

-- Update existing folders: try to guess type from name
UPDATE public.material_folders SET type = 'general_docs' WHERE lower(name) LIKE '%общ%' OR lower(name) LIKE '%документ%' OR lower(name) LIKE '%general%';
UPDATE public.material_folders SET type = 'materials' WHERE type IS NULL OR type = 'materials';