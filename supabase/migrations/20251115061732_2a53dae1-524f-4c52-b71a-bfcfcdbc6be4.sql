-- Добавляем новые роли в enum
ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'editor';
ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'viewer';