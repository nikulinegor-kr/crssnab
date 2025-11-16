-- Create table for site content management
CREATE TABLE IF NOT EXISTS public.site_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  section text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, section)
);

-- Enable RLS
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view org site content"
  ON public.site_content
  FOR SELECT
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can manage site content"
  ON public.site_content
  FOR ALL
  USING (user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

-- Add trigger for updated_at
CREATE TRIGGER update_site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default content for hero section
INSERT INTO public.site_content (organization_id, section, content)
SELECT 
  id as organization_id,
  'hero' as section,
  jsonb_build_object(
    'title', 'Система управления заявками для вашего бизнеса',
    'subtitle', 'Оптимизируйте процессы, повышайте эффективность и контролируйте выполнение задач в режиме реального времени',
    'cta_primary', 'Попробовать бесплатно',
    'cta_secondary', 'Демо-версия'
  ) as content
FROM public.organizations
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_content WHERE section = 'hero'
);

COMMENT ON TABLE public.site_content IS 'Stores customizable content for the landing page';
COMMENT ON COLUMN public.site_content.section IS 'Section identifier (hero, features, pricing, etc.)';
COMMENT ON COLUMN public.site_content.content IS 'JSON content for the section';