-- Add new fields to organizations table for general settings and branding
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#1A1F2C',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#9b87f5';