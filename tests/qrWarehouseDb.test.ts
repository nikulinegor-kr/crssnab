import { beforeAll, describe, expect, test } from "bun:test";
import { execFileSync, spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

// Runs only against a disposable local PostgreSQL (socket under /tmp), never against project data.
const socket = process.env.LOCAL_WAREHOUSE_TEST_SOCKET;
const port = process.env.LOCAL_WAREHOUSE_TEST_PORT ?? "55442";
const suite = socket ? describe : describe.skip;
const ORG = "00000000-0000-0000-0000-0000000000a1";
const OTHER = "00000000-0000-0000-0000-0000000000b2";
const USER = "00000000-0000-0000-0000-000000000011";
const STRANGER = "00000000-0000-0000-0000-000000000022";
const WH = "00000000-0000-0000-0000-00000000c001";
const WH_OTHER = "00000000-0000-0000-0000-00000000c002";
const REQ = "00000000-0000-0000-0000-00000000d001";

const args = () => ["-h", socket!, "-p", port, "-U", "lovable", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-At"];
function sql(q: string) {
  if (!socket?.startsWith("/tmp/")) throw Error("Disposable database required");
  return execFileSync("psql", args(), { input: q, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}
function sqlAsync(q: string) {
  return new Promise<{ code: number; out: string }>((resolve) => {
    const p = spawn("psql", args());
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code: code ?? 1, out }));
    p.stdin.end(q);
  });
}
const as = (uid: string, q: string) => `BEGIN; SELECT set_config('test.uid','${uid}',true); SET LOCAL ROLE authenticated; ${q} COMMIT;`;
const scalar = (q: string) => sql(q).trim().split("\n").pop()!;
const balance = (unit: string, cell: string) => scalar(`SELECT COALESCE(sum(quantity),0)::int FROM warehouse_balances WHERE unit_id='${unit}' AND cell_id='${cell}';`);

function newDoc(type: string, lines: string, extra = "") {
  const id = scalar(as(USER, `INSERT INTO warehouse_documents(organization_id,doc_type${extra ? "," + extra.split("|")[0] : ""}) VALUES('${ORG}','${type}'${extra ? "," + extra.split("|")[1] : ""}) RETURNING id;`).replace("COMMIT;", "COMMIT;"));
  sql(as(USER, lines.replaceAll("$DOC", id)));
  return id;
}
const post = (doc: string, uid = USER) => sql(as(uid, `SELECT post_warehouse_document('${doc}')->>'already_posted';`));

suite("QR warehouse posting on real PostgreSQL", () => {
  let cellA = "", cellB = "", batch = "";
  beforeAll(() => {
    sql(`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public; CREATE SCHEMA auth;
      DO $$BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END$$;
      DO $$BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END$$;
      DO $$BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END$$;
      GRANT USAGE ON SCHEMA public, auth TO authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      CREATE TABLE organizations(id uuid PRIMARY KEY);
      CREATE TABLE members(user_id uuid, organization_id uuid);
      CREATE TABLE warehouses(id uuid PRIMARY KEY, organization_id uuid);
      CREATE TABLE warehouse_products(id uuid PRIMARY KEY, organization_id uuid);
      CREATE TABLE requests(id uuid PRIMARY KEY, organization_id uuid);
      CREATE TABLE request_objects(id uuid PRIMARY KEY, organization_id uuid);
      CREATE FUNCTION user_has_org_access(u uuid, o uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.members WHERE user_id=u AND organization_id=o) $$;
      CREATE FUNCTION user_has_permission(u uuid, o uuid, k text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT public.user_has_org_access(u,o) $$;
      INSERT INTO organizations VALUES('${ORG}'),('${OTHER}');
      INSERT INTO members VALUES('${USER}','${ORG}'),('${STRANGER}','${OTHER}');
      INSERT INTO warehouses VALUES('${WH}','${ORG}'),('${WH_OTHER}','${OTHER}');
      INSERT INTO requests VALUES('${REQ}','${ORG}');`);
    const file = readdirSync(new URL("../drizzle/migrations", import.meta.url)).find((f) => f.includes("qr_warehouse"))!;
    sql(readFileSync(new URL(`../drizzle/migrations/${file}`, import.meta.url), "utf8"));
    cellA = scalar(as(USER, `INSERT INTO warehouse_cells(organization_id,warehouse_id,code) VALUES('${ORG}','${WH}','A-01') RETURNING id;`));
    cellB = scalar(as(USER, `INSERT INTO warehouse_cells(organization_id,warehouse_id,code) VALUES('${ORG}','${WH}','B-01') RETURNING id;`));
    batch = scalar(as(USER, `INSERT INTO warehouse_units(organization_id,kind,name,batch_number,unit) VALUES('${ORG}','batch','Болт М16','П-1','шт') RETURNING id;`));
  });

  test("3 unique items receive with distinct permanent QR and cannot be received twice", () => {
    const ids = [1, 2, 3].map((n) => scalar(as(USER, `INSERT INTO warehouse_units(organization_id,kind,name,serial_number) VALUES('${ORG}','item','Генератор','SN-${n}') RETURNING id;`)));
    const qr = ids.map((id) => scalar(`SELECT qr_token FROM warehouse_units WHERE id='${id}';`));
    expect(new Set(qr).size).toBe(3);
    const doc = newDoc("receipt", ids.map((id) => `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id,to_cell_id) VALUES('${ORG}','$DOC','${id}',1,'${WH}','${cellA}');`).join(""));
    post(doc);
    expect(ids.map((id) => balance(id, cellA))).toEqual(["1", "1", "1"]);
    sql(as(USER, `UPDATE warehouse_units SET qr_token='forged', name='Генератор 1' WHERE id='${ids[0]}';`));
    expect(scalar(`SELECT qr_token FROM warehouse_units WHERE id='${ids[0]}';`)).toBe(qr[0]);
    const again = newDoc("receipt", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id,to_cell_id) VALUES('${ORG}','$DOC','${ids[0]}',1,'${WH}','${cellB}');`);
    expect(() => post(again)).toThrow(/уже числится/);
    const two = newDoc("receipt", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id) VALUES('${ORG}','$DOC','${ids[1]}',2,'${WH}');`);
    expect(() => post(two)).toThrow(/поштучно/);
  });

  test("100 received -> move 30 -> issue 10 leaves 70 + 20; repeat posting is idempotent", () => {
    const rec = newDoc("receipt", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id,to_cell_id) VALUES('${ORG}','$DOC','${batch}',100,'${WH}','${cellA}');`);
    post(rec);
    const mv = newDoc("move", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,from_warehouse_id,from_cell_id,to_warehouse_id,to_cell_id) VALUES('${ORG}','$DOC','${batch}',30,'${WH}','${cellA}','${WH}','${cellB}');`);
    post(mv);
    const iss = newDoc("issue", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,from_warehouse_id,from_cell_id) VALUES('${ORG}','$DOC','${batch}',10,'${WH}','${cellB}');`, `recipient_name,request_id|'Иванов И.И.','${REQ}'`);
    expect(post(iss)).toContain("false");
    expect(post(iss)).toContain("true");
    expect(post(mv)).toContain("true");
    expect([balance(batch, cellA), balance(batch, cellB)]).toEqual(["70", "20"]);
    expect(scalar(`SELECT count(*) FROM warehouse_ledger WHERE document_id='${iss}';`)).toBe("1");
    expect(scalar(`SELECT count(*) FROM warehouse_documents WHERE status='posted' AND number LIKE 'СК-%';`)).toBe(scalar(`SELECT count(DISTINCT number) FROM warehouse_documents WHERE status='posted';`));
    // posted documents are immutable for users
    expect(sql(as(USER, `UPDATE warehouse_documents SET comment='x' WHERE id='${iss}';`))).toContain("UPDATE 0");
  });

  test("issue requires recipient and request/object; negative stock is rejected", () => {
    const noRecipient = newDoc("issue", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,from_warehouse_id,from_cell_id) VALUES('${ORG}','$DOC','${batch}',1,'${WH}','${cellA}');`);
    expect(() => post(noRecipient)).toThrow(/получателя/);
    const tooMuch = newDoc("issue", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,from_warehouse_id,from_cell_id) VALUES('${ORG}','$DOC','${batch}',21,'${WH}','${cellB}');`, `recipient_name,request_id|'Петров','${REQ}'`);
    expect(() => post(tooMuch)).toThrow(/Недостаточно/);
    expect(balance(batch, cellB)).toBe("20");
  });

  test("return is limited by issued quantity", () => {
    const issue = scalar(`SELECT id FROM warehouse_issues WHERE unit_id='${batch}' LIMIT 1;`);
    const over = newDoc("return", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,issue_id) VALUES('${ORG}','$DOC','${batch}',11,'${issue}');`);
    expect(() => post(over)).toThrow(/больше выданного/);
    const ok = newDoc("return", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,issue_id) VALUES('${ORG}','$DOC','${batch}',4,'${issue}');`);
    post(ok);
    expect(balance(batch, cellB)).toBe("24");
    const rest = newDoc("return", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,issue_id) VALUES('${ORG}','$DOC','${batch}',7,'${issue}');`);
    expect(() => post(rest)).toThrow(/больше выданного/);
    sql(`UPDATE warehouse_document_lines SET quantity=6 WHERE document_id='${rest}';`);
    post(rest);
    expect(balance(batch, cellB)).toBe("30");
    // restore 20 in B for following tests
    const back = newDoc("move", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,from_warehouse_id,from_cell_id,to_warehouse_id,to_cell_id) VALUES('${ORG}','$DOC','${batch}',10,'${WH}','${cellB}','${WH}','${cellA}');`);
    post(back);
    expect([balance(batch, cellA), balance(batch, cellB)]).toEqual(["80", "20"]);
  });

  test("concurrent issues of the same stock: one wins, the other is blocked, no negative balance", async () => {
    const line = (q: number) => `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,from_warehouse_id,from_cell_id) VALUES('${ORG}','$DOC','${batch}',${q},'${WH}','${cellB}');`;
    const a = newDoc("issue", line(15), `recipient_name,request_id|'А','${REQ}'`);
    const b = newDoc("issue", line(15), `recipient_name,request_id|'Б','${REQ}'`);
    const first = sqlAsync(as(USER, `SELECT post_warehouse_document('${a}'); SELECT pg_sleep(1);`));
    await new Promise((r) => setTimeout(r, 300));
    const second = sqlAsync(as(USER, `SELECT post_warehouse_document('${b}');`));
    const [r1, r2] = await Promise.all([first, second]);
    expect([r1.code, r2.code].sort()).toEqual([0, 3]);
    expect(r2.out).toMatch(/Недостаточно/);
    expect(balance(batch, cellB)).toBe("5");
    // concurrent double-posting of the same document applies once
    const c = newDoc("issue", line(2), `recipient_name,request_id|'В','${REQ}'`);
    const [p1, p2] = await Promise.all([sqlAsync(as(USER, `SELECT post_warehouse_document('${c}');`)), sqlAsync(as(USER, `SELECT post_warehouse_document('${c}');`))]);
    expect(p1.code + p2.code).toBe(0);
    expect(balance(batch, cellB)).toBe("3");
  });

  test("other organization cannot see, change or post", () => {
    expect(scalar(as(STRANGER, `SELECT count(*) FROM warehouse_balances;`))).toBe("0");
    expect(scalar(as(STRANGER, `SELECT count(*) FROM warehouse_units;`))).toBe("0");
    expect(() => sql(as(STRANGER, `INSERT INTO warehouse_documents(organization_id,doc_type) VALUES('${ORG}','receipt');`))).toThrow();
    expect(() => sql(as(STRANGER, `INSERT INTO warehouse_balances(organization_id,unit_id,warehouse_id,quantity) VALUES('${OTHER}','${batch}','${WH_OTHER}',5);`))).toThrow();
    const doc = newDoc("receipt", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id) VALUES('${ORG}','$DOC','${batch}',5,'${WH}');`);
    expect(() => post(doc, STRANGER)).toThrow(/Нет доступа/);
    // foreign warehouse inside own document is rejected by the posting function
    const foreign = newDoc("receipt", `INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id) VALUES('${ORG}','$DOC','${batch}',5,'${WH_OTHER}');`);
    expect(() => post(foreign)).toThrow(/другой организации/);
    expect(() => sql(as(USER, `SELECT warehouse_apply_delta('${ORG}','${doc}',null,'${batch}','${WH}',null,1000,'hack','${USER}');`))).toThrow();
  });
});
