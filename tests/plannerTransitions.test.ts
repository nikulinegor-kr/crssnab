import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Run against a disposable local PostgreSQL instance, never the hosted database.
const socket = process.env.LOCAL_PLANNER_TEST_SOCKET;
const suite = socket ? describe : describe.skip;
const actor = "00000000-0000-0000-0000-000000000001";
const reviewer = "00000000-0000-0000-0000-000000000002";
const creator = "00000000-0000-0000-0000-000000000003";
const org = "00000000-0000-0000-0000-000000000004";
const task = "00000000-0000-0000-0000-000000000005";

function sql(query: string): string {
  if (!socket?.startsWith("/tmp/")) throw new Error("A disposable local test socket is required");
  return execFileSync("psql", ["-h", socket, "-p", "55439", "-U", "lovable", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-At"], {
    input: query,
    encoding: "utf8",
    env: { ...process.env, PGHOST: socket, PGPORT: "55439", PGUSER: "lovable", PGDATABASE: "postgres", PGPASSWORD: "" },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function check(body: string, user: string | null = actor) {
  return sql(`BEGIN; SELECT set_config('test.actor', '${user ?? ""}', true); ${body} ROLLBACK;`);
}

suite("actual PostgreSQL planner transition triggers", () => {
  beforeAll(() => {
    sql(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;
      CREATE TYPE public.organization_role AS ENUM ('owner','admin','member');
      CREATE TABLE public.organizations(id uuid PRIMARY KEY);
      CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text);
      CREATE TABLE public.user_organizations(user_id uuid, organization_id uuid, role organization_role);
      CREATE FUNCTION public.user_has_org_access(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM user_organizations WHERE user_id=$1 AND organization_id=$2) $$;
      CREATE FUNCTION public.user_has_org_role(uuid,uuid,organization_role) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM user_organizations WHERE user_id=$1 AND organization_id=$2 AND role=$3) $$;
      CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
      CREATE TABLE public.planner_tasks(id uuid PRIMARY KEY, organization_id uuid, title text, description text, status text, priority text, assignee_id uuid, created_by uuid, due_date timestamptz, request_id uuid, source text);
      CREATE TABLE public.planner_task_activity(task_id uuid, organization_id uuid, user_id uuid, action text, field_name text, old_value text, new_value text, description text);
      CREATE FUNCTION public.planner_priority_label(text) RETURNS text LANGUAGE sql AS $$ SELECT $1 $$;
      CREATE FUNCTION public.planner_notify_users(uuid,uuid,text,text,uuid[]) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
      CREATE FUNCTION public.enqueue_notification(uuid,text,text,text,text,jsonb,text) RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
    `);
    sql(readFileSync(new URL("../drizzle/migrations/0008_planner_foundation_departments_and_transitions.sql", import.meta.url), "utf8"));
    sql(`
      CREATE TRIGGER planner_tasks_activity AFTER INSERT OR UPDATE ON public.planner_tasks FOR EACH ROW EXECUTE FUNCTION public.planner_task_log_and_notify();
      INSERT INTO organizations VALUES ('${org}');
      INSERT INTO profiles VALUES ('${actor}','Исполнитель'),('${reviewer}','Контролёр'),('${creator}','Создатель');
      INSERT INTO user_organizations(user_id,organization_id,role) VALUES ('${actor}','${org}','member');
      INSERT INTO planner_tasks(id,organization_id,title,status,priority,created_by) VALUES ('${task}','${org}','Проверка','backlog','medium','${creator}');
    `);
  });
  afterAll(() => { /* The caller destroys the disposable cluster. */ });

  const rejects = (update: string, message: string) => {
    expect(check(`DO $$ BEGIN
      BEGIN ${update}; RAISE EXCEPTION 'Expected rejection did not occur';
      EXCEPTION WHEN OTHERS THEN IF SQLERRM <> '${message}' THEN RAISE; END IF; END;
    END $$;`)).toContain("ROLLBACK");
  };
  test("acceptance requires a reviewer", () => {
    rejects(`UPDATE planner_tasks SET requires_acceptance=true WHERE id='${task}'`, "Для задачи с приёмкой нужен контролёр");
  });
  test("waiting rejects a blank blocked reason", () => {
    rejects(`UPDATE planner_tasks SET status='waiting',blocked_reason='  ' WHERE id='${task}'`, "Укажите причину ожидания");
  });
  test("rework rejects a blank change reason", () => {
    rejects(`UPDATE planner_tasks SET status='rework',change_reason='  ' WHERE id='${task}'`, "Укажите, что доработать");
  });
  test("an assignee cannot close a task requiring acceptance", () => {
    rejects(`UPDATE planner_tasks SET requires_acceptance=true,reviewer_id='${reviewer}',status='done' WHERE id='${task}'`, "Задачу с приёмкой закрывает контролёр — передайте её на проверку");
  });
  for (const [name, user] of [["reviewer", reviewer], ["creator", creator]] as const) {
    test(`${name} can close a task requiring acceptance`, () => {
      expect(check(`UPDATE planner_tasks SET requires_acceptance=true,reviewer_id='${reviewer}',status='done' WHERE id='${task}'; SELECT status FROM planner_tasks WHERE id='${task}';`, user)).toContain("done");
    });
  }
  for (const role of ["owner", "admin"]) {
    test(`${role} can close a task requiring acceptance`, () => {
      expect(check(`UPDATE user_organizations SET role='${role}'; UPDATE planner_tasks SET requires_acceptance=true,reviewer_id='${reviewer}',status='done' WHERE id='${task}'; SELECT status FROM planner_tasks WHERE id='${task}';`)).toContain("done");
    });
  }
  test("leaving waiting clears both blocked fields", () => {
    expect(check(`UPDATE planner_tasks SET status='waiting',blocked_reason='Поставка',blocked_until='2026-11-01' WHERE id='${task}'; UPDATE planner_tasks SET status='in_progress' WHERE id='${task}'; SELECT blocked_reason IS NULL AND blocked_until IS NULL FROM planner_tasks WHERE id='${task}';`)).toContain("\nt\n");
  });
  test("acceptance stamps accepted_at and preserves an existing stamp", () => {
    expect(check(`UPDATE planner_tasks SET status='accepted' WHERE id='${task}'; SELECT accepted_at=now() FROM planner_tasks WHERE id='${task}'; UPDATE planner_tasks SET status='backlog'; UPDATE planner_tasks SET status='accepted',accepted_at='2026-10-01'; SELECT accepted_at='2026-10-01'::timestamptz FROM planner_tasks;`)).toContain("\nt\n");
  });
  test("cron without auth.uid bypasses transition checks", () => {
    expect(check(`UPDATE planner_tasks SET status='rework',requires_acceptance=true WHERE id='${task}'; SELECT status FROM planner_tasks;`, null)).toContain("rework");
  });
  test("reason is recorded for status, deadline, assignee, priority, reviewer and department", () => {
    expect(check(`INSERT INTO departments(id,organization_id,name) VALUES ('${org}','${org}','Отдел');
      UPDATE planner_tasks SET status='rework',due_date='2026-11-01',assignee_id='${actor}',priority='high',reviewer_id='${reviewer}',department_id='${org}',change_reason='Исправить результат' WHERE id='${task}';
      DO $$ BEGIN
        IF (SELECT count(*) FROM planner_task_activity WHERE task_id='${task}' AND reason='Исправить результат' AND field_name IN ('status','due_date','assignee_id','priority','reviewer_id','department_id')) <> 6 THEN RAISE EXCEPTION 'Missing activity reasons'; END IF;
        IF (SELECT change_reason IS NOT NULL FROM planner_tasks WHERE id='${task}') THEN RAISE EXCEPTION 'Reason was not cleared'; END IF;
      END $$;`)).toContain("ROLLBACK");
  });
  test("a later update without reason cannot inherit an earlier reason", () => {
    expect(check(`UPDATE planner_tasks SET priority='high',change_reason='Срочно' WHERE id='${task}'; UPDATE planner_tasks SET priority='low' WHERE id='${task}'; SELECT reason IS NULL FROM planner_task_activity WHERE new_value='low';`)).toContain("\nt\n");
  });
});