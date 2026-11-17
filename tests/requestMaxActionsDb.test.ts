import { beforeAll, test, expect, describe } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const socket = process.env.LOCAL_MAX_TEST_SOCKET;
function sql(query: string) {
  if (!socket?.startsWith('/tmp/')) throw new Error('Isolated database required');
  return execFileSync('psql', ['-h', socket, '-p', '55449', '-U', 'lovable', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8' }).trim();
}
const org = '00000000-0000-0000-0000-000000000001';
const actor = '00000000-0000-0000-0000-000000000002';
const req = '00000000-0000-0000-0000-000000000003';
const obj = '00000000-0000-0000-0000-000000000004';
(socket ? describe : describe.skip)('MAX request actions on isolated PostgreSQL', () => {
beforeAll(() => {
  sql(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${actor}'::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
    CREATE TABLE profiles(id uuid, full_name text, email text);
    CREATE TABLE request_objects(id uuid,name text,organization_id uuid);
    CREATE TABLE warehouses(id uuid,name text,organization_id uuid);
    CREATE TABLE requests(id uuid, organization_id uuid,request_number text,description text,object_id uuid,warehouse_id uuid);
    CREATE TABLE max_groups(organization_id uuid,group_id text,group_name text,notification_type text,is_active boolean);
    CREATE TABLE notification_queue(organization_id uuid,event_type text,entity_type text,entity_id text,platform text,group_id text,group_name text,payload jsonb,status text,dedup_key text);
    CREATE FUNCTION get_notification_mode(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'production'::text $$;
    INSERT INTO profiles VALUES('${actor}','Тестовый сотрудник','actor@example.test');
    INSERT INTO request_objects VALUES('${obj}','Новый объект','${org}');
    INSERT INTO max_groups VALUES('${org}','test-chat','Тест MAX','supply',true),('00000000-0000-0000-0000-000000000099','foreign-chat','Чужая группа','supply',true);
    INSERT INTO requests VALUES('${req}','${org}','00001','Синтетическая заявка',NULL,NULL);`);
  const dir = new URL('../drizzle/migrations/', import.meta.url);
  const migration = readdirSync(dir).find(name => name.endsWith('_request_max_actions.sql'));
  const path = process.env.LOCAL_MAX_TEST_SQL ?? (migration ? new URL(migration, dir) : undefined);
  if (!path) throw new Error('Notification migration required');
  sql(readFileSync(path, 'utf8'));
});
test('transfer queues MAX only in the request organization with authenticated account and old/new destination', () => {
  sql(`UPDATE requests SET object_id='${obj}' WHERE id='${req}';`);
  const rows = JSON.parse(sql('SELECT jsonb_agg(notification_queue) FROM notification_queue;'));
  expect(rows).toHaveLength(1);
  expect(rows[0].platform).toBe('max');
  expect(rows[0].group_id).toBe('test-chat');
  expect(rows[0].event_type).toBe('request.transferred');
  expect(rows[0].payload.actor_id).toBe(actor);
  expect(rows[0].payload.actor_email).toBe('actor@example.test');
  expect(rows[0].payload.new_object).toBe('Новый объект');
  expect(rows[0].payload.old_object).toBe('—');
});
test('unchanged destination does not emit another transfer', () => {
  sql(`UPDATE requests SET object_id='${obj}' WHERE id='${req}';`);
  expect(sql('SELECT count(*) FROM notification_queue;')).toBe('1');
});
test('failed transaction rolls back deletion and notification together', () => {
  sql(`BEGIN; DELETE FROM requests WHERE id='${req}'; ROLLBACK;`);
  expect(sql('SELECT count(*) FROM requests;')).toBe('1');
  expect(sql(`SELECT count(*) FROM notification_queue WHERE event_type='request.deleted';`)).toBe('0');
});
test('permanent deletion retains request snapshot and the account in MAX queue', () => {
  sql(`DELETE FROM requests WHERE id='${req}';`);
  const payload = JSON.parse(sql(`SELECT payload FROM notification_queue WHERE event_type='request.deleted';`));
  expect(payload.request_number).toBe('00001');
  expect(payload.description).toBe('Синтетическая заявка');
  expect(payload.actor_email).toBe('actor@example.test');
  expect(sql('SELECT count(*) FROM requests;')).toBe('0');
});
});