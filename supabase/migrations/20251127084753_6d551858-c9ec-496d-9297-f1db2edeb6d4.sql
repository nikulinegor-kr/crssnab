-- Удаляем дубликаты, оставляя только самую раннюю запись (по created_at) для каждой пары user_id + organization_id
DELETE FROM user_organizations a
USING user_organizations b
WHERE a.user_id = b.user_id 
  AND a.organization_id = b.organization_id 
  AND a.created_at > b.created_at;

-- Добавляем уникальное ограничение, чтобы предотвратить дубликаты в будущем
ALTER TABLE user_organizations
ADD CONSTRAINT user_organizations_user_org_unique UNIQUE (user_id, organization_id);