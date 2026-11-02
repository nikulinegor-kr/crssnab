import { beforeAll, describe, expect, test } from 'bun:test';
import { execFileSync, spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

// Full warehouse cycle invariants. Runs ONLY against a disposable local PostgreSQL socket under /tmp.
const socket = process.env.LOCAL_WAREHOUSE_TEST_SOCKET;
const suite = socket ? describe : describe.skip;
const ORG = '00000000-0000-0000-0000-0000000000a1', OTHER = '00000000-0000-0000-0000-0000000000b2';
const USER = '00000000-0000-0000-0000-000000000011', STRANGER = '00000000-0000-0000-0000-000000000022', WORKER = '00000000-0000-0000-0000-000000000033';
const WHA = '00000000-0000-0000-0000-00000000ca01', WHB = '00000000-0000-0000-0000-00000000ca02', WHF = '00000000-0000-0000-0000-00000000c002';
const REQ = '00000000-0000-0000-0000-00000000da01', ITEM = '00000000-0000-0000-0000-00000000ea01', REQ0 = '00000000-0000-0000-0000-00000000da02';
const OBJ = '00000000-0000-0000-0000-00000000fa01', EQ = '00000000-0000-0000-0000-00000000f001';
const args = () => ['-h', socket ?? '', '-p', process.env.LOCAL_WAREHOUSE_TEST_PORT ?? '55442', '-U', 'lovable', '-d', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'];
function sql(q: string) { if (!socket?.startsWith('/tmp/')) throw Error('Disposable local database required'); return execFileSync('psql', args(), { input: q, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
const scalar = (q: string) => sql(q).trim().split('\n').pop() ?? '';
const as = (q: string, u = USER) => `BEGIN;SELECT set_config('test.uid','${u}',true);SET LOCAL ROLE authenticated;${q} COMMIT;`;
function run(q: string) { return new Promise<{ code: number; out: string }>(resolve => { const p = spawn('psql', args()); let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); p.on('close', code => resolve({ code: code ?? 1, out })); p.stdin.end(q); }); }
const key = () => crypto.randomUUID();
const stock = (unit: string, wh: string) => scalar(`SELECT coalesce(sum(quantity),0)::int FROM warehouse_balances WHERE unit_id='${unit}' AND warehouse_id='${wh}';`);
const partial = (k: string, lines: string, confirm = true, req = REQ, wh = WHA, u = USER) => as(`SELECT receive_request_partial('${k}','${req}','${wh}','${USER}','${lines}',${confirm});`, u);
const issueRow = (id: string) => scalar(`SELECT concat_ws('/',issued_qty::int,returned_qty::int,installed_qty::int,consumed_qty::int) FROM warehouse_issues WHERE id='${id}';`);

suite('Full warehouse cycle on disposable PostgreSQL', () => {
  let unit = '';
  beforeAll(() => {
    execFileSync('bun', ['test', '--timeout', '120000', 'tests/simpleWarehouseDb.test.ts'], { env: process.env, stdio: 'pipe' });
    for (const name of ['manual_warehouse_receipt', 'receipt_units_sht_komplekt']) { const f = readdirSync('drizzle/migrations').find(x => x.includes(name)); if (!f) throw Error(`Migration ${name} missing`); sql(readFileSync(`drizzle/migrations/${f}`, 'utf8')); }
    if (process.env.LOCAL_CYCLE_SQL) sql(readFileSync(process.env.LOCAL_CYCLE_SQL, 'utf8'));
    else for (const name of ['warehouse_full_cycle', 'warehouse_issue_manual_recipient', 'post_document_manual_recipient']) { const f = readdirSync('drizzle/migrations').find(x => x.includes(name)); if (!f) throw Error(`Migration ${name} missing`); sql(readFileSync(`drizzle/migrations/${f}`, 'utf8')); }
    sql(`UPDATE user_organizations SET role='admin' WHERE user_id='${USER}'; DELETE FROM user_permissions WHERE user_id='${USER}'; ALTER TABLE equipment ADD COLUMN IF NOT EXISTS model text; INSERT INTO members VALUES('${WORKER}','${ORG}'); INSERT INTO user_organizations VALUES('${WORKER}','${ORG}',true,'member');
      INSERT INTO user_permissions VALUES('${WORKER}','${ORG}','erp.warehouse',false);
      INSERT INTO profiles VALUES('${WORKER}','Рабочий Петров') ON CONFLICT DO NOTHING;
      INSERT INTO request_objects VALUES('${OBJ}','${ORG}') ON CONFLICT DO NOTHING;
      INSERT INTO warehouses(id,organization_id,name) VALUES('${WHA}','${ORG}','Склад А'),('${WHB}','${ORG}','Склад Б');
      INSERT INTO requests(id,organization_id,status,request_number,description) VALUES('${REQ}','${ORG}','В пути','R-1','Фильтры'),('${REQ0}','${ORG}','Доставлено','R-0','Рации без позиций');
      INSERT INTO request_items VALUES('${ITEM}','${ORG}','${REQ}','Фильтр масляный',10);`);
    sql('GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;');
  }, 120000);

  test('partial receipt 8 of 10 then 2: never above expected, discrepancy must be confirmed', () => {
    expect(() => sql(partial(key(), `[{"item_id":"${ITEM}","accepted":8,"unit":"шт"}]`, false))).toThrow(/подтвердите/);
    expect(scalar(`SELECT count(*) FROM warehouse_receipt_batches WHERE request_id='${REQ}';`)).toBe('0');
    const k1 = key();
    sql(partial(k1, `[{"item_id":"${ITEM}","accepted":8,"unit":"шт"}]`));
    unit = scalar(`SELECT unit_id FROM warehouse_receipt_batch_lines WHERE request_item_id='${ITEM}' AND accepted_qty=8;`);
    expect(stock(unit, WHA)).toBe('8');
    sql(partial(k1, `[{"item_id":"${ITEM}","accepted":8,"unit":"шт"}]`)); // retry same key
    expect(scalar(`SELECT coalesce(sum(quantity),0)::int FROM warehouse_balances b JOIN warehouse_units u ON u.id=b.unit_id WHERE u.request_item_id='${ITEM}';`)).toBe('8');
    expect(() => sql(partial(key(), `[{"item_id":"${ITEM}","accepted":3,"unit":"шт"}]`))).toThrow(/осталось получить 2/);
    sql(partial(key(), `[{"item_id":"${ITEM}","accepted":1,"defect":1,"note":"Трещина корпуса","unit":"шт"}]`));
    expect(scalar(`SELECT coalesce(sum(quantity),0)::int FROM warehouse_balances b JOIN warehouse_units u ON u.id=b.unit_id WHERE u.request_item_id='${ITEM}';`)).toBe('9');
    expect(() => sql(partial(key(), `[{"item_id":"${ITEM}","accepted":1,"unit":"шт"}]`))).toThrow(/осталось получить 0/);
    expect(scalar(`SELECT count(*) FROM warehouse_request_receipts WHERE request_id='${REQ}';`)).toBe('0');
  });

  test('defect needs note; fallback without items needs explicit expected quantity', () => {
    sql(`UPDATE requests SET status='Доставлено' WHERE id='${REQ0}';`);
    expect(() => sql(partial(key(), `[{"accepted":2,"unit":"комплект"}]`, true, REQ0))).toThrow(/ожидаемое/);
    sql(partial(key(), `[{"accepted":2,"expected":5,"unit":"комплект"}]`, true, REQ0));
    expect(() => sql(partial(key(), `[{"accepted":4,"unit":"комплект"}]`, true, REQ0))).toThrow(/осталось получить 3/);
    expect(() => sql(partial(key(), `[{"accepted":1,"defect":1,"unit":"комплект"}]`, true, REQ0))).toThrow(/примечание/);
  });

  test('concurrent partial receipts never exceed expected quantity', async () => {
    const id = '00000000-0000-0000-0000-00000000ea09', req = '00000000-0000-0000-0000-00000000da09';
    sql(`INSERT INTO requests(id,organization_id,status,request_number,description) VALUES('${req}','${ORG}','Доставлено','R-9','Гонка');INSERT INTO request_items VALUES('${id}','${ORG}','${req}','Болт',10);`);
    const q = partial(key(), `[{"item_id":"${id}","accepted":6,"unit":"шт"}]`, true, req);
    const q2 = partial(key(), `[{"item_id":"${id}","accepted":6,"unit":"шт"}]`, true, req);
    const res = await Promise.all([run(q), run(q2)]);
    expect(res.filter(r => r.code === 0).length).toBe(1);
    expect(scalar(`SELECT sum(accepted_qty)::int FROM warehouse_receipt_batch_lines WHERE request_item_id='${id}';`)).toBe('6');
  });

  test('issue 10 -> return 2 -> consume 3 leaves 5 outstanding; limits enforced; single stock write-off', () => {
    const m = scalar(as(`SELECT manual_warehouse_receipt('${key()}','${WHA}','Перчатки','batch',20,'шт',NULL,NULL)->>'document_id';`));
    const u = scalar(`SELECT unit_id FROM warehouse_document_lines WHERE document_id='${m}';`);
    const k = key();
    sql(as(`SELECT warehouse_issue('${k}','${u}','${WHA}',10,'Петров','${WORKER}','2026-11-01',NULL,'${OBJ}','на смену');`));
    sql(as(`SELECT warehouse_issue('${k}','${u}','${WHA}',10,'Петров','${WORKER}','2026-11-01',NULL,'${OBJ}','на смену');`));
    expect(stock(u, WHA)).toBe('10');
    const iss = scalar(`SELECT id FROM warehouse_issues WHERE unit_id='${u}';`);
    // Received confirmation: only recipient (or admin) and never touches stock.
    expect(() => sql(as(`SELECT confirm_issue_received('${iss}');`, STRANGER))).toThrow(/доступа/);
    sql(as(`SELECT confirm_issue_received('${iss}');`, WORKER));
    expect(scalar(as(`SELECT confirm_issue_received('${iss}')->>'already';`, WORKER))).toBe('true');
    expect(scalar(`SELECT received_confirmed_by::text||'/'||received_confirmed_proxy FROM warehouse_issues WHERE id='${iss}';`)).toBe(`${WORKER}/false`);
    expect(stock(u, WHA)).toBe('10');
    sql(as(`SELECT warehouse_return_issue('${key()}','${iss}',2,'${WHB}','good','');`));
    sql(as(`SELECT warehouse_issue_usage('${key()}','${iss}','consume',3,NULL,'2026-11-02','');`));
    expect(issueRow(iss)).toBe('10/2/0/3');
    expect(scalar(`SELECT (issued_qty-returned_qty-installed_qty-consumed_qty)::int FROM warehouse_issues WHERE id='${iss}';`)).toBe('5');
    expect(stock(u, WHB)).toBe('2');
    expect(() => sql(as(`SELECT warehouse_issue_usage('${key()}','${iss}','consume',6,NULL,'2026-11-02','');`))).toThrow(/доступно 5/);
    expect(() => sql(as(`SELECT warehouse_return_issue('${key()}','${iss}',6,'${WHA}','good','');`))).toThrow(/доступно 5/);
    expect(() => sql(as(`SELECT warehouse_issue_usage('${key()}','${iss}','install',1,NULL,'2026-11-02','');`))).toThrow(/технику/);
    sql(as(`SELECT warehouse_issue_usage('${key()}','${iss}','install',1,'${EQ}','2026-11-02','');`));
    expect(issueRow(iss)).toBe('10/2/1/3');
    // Damaged return is kept apart from available stock.
    sql(as(`SELECT warehouse_return_issue('${key()}','${iss}',1,'${WHA}','damaged','сломан');`));
    expect(stock(u, WHA)).toBe('10');
    expect(scalar(`SELECT quantity::int FROM warehouse_damaged_balances WHERE unit_id='${u}' AND warehouse_id='${WHA}';`)).toBe('1');
    // Stranger organization cannot operate.
    expect(() => sql(as(`SELECT warehouse_issue_usage('${key()}','${iss}','consume',1,NULL,'2026-11-02','');`, STRANGER))).toThrow(/доступа/);
    expect(() => sql(as(`SELECT warehouse_issue_usage('${key()}','${iss}','consume',1,NULL,'2026-11-02','');`, WORKER))).toThrow(/доступа/);
  });

  test('manual recipient without a user account can receive an issue; listed-user rules still enforced', () => {
    const m = scalar(as(`SELECT manual_warehouse_receipt('${key()}','${WHA}','Ведро','batch',5,'шт',NULL,NULL)->>'document_id';`));
    const u = scalar(`SELECT unit_id FROM warehouse_document_lines WHERE document_id='${m}';`);
    const k = key();
    sql(as(`SELECT warehouse_issue('${k}','${u}','${WHA}',2,'Подрядчик Иванов',NULL,'2026-11-02',NULL,NULL,'');`));
    sql(as(`SELECT warehouse_issue('${k}','${u}','${WHA}',2,'Подрядчик Иванов',NULL,'2026-11-02',NULL,NULL,'');`));
    expect(stock(u, WHA)).toBe('3');
    const iss = scalar(`SELECT id FROM warehouse_issues WHERE unit_id='${u}' AND recipient_user_id IS NULL;`);
    expect(issueRow(iss)).toBe('2/0/0/0');
    expect(() => sql(as(`SELECT confirm_issue_received('${iss}');`, STRANGER))).toThrow(/доступа/);
    sql(as(`SELECT confirm_issue_received('${iss}');`, USER));
    expect(scalar(`SELECT received_confirmed_proxy FROM warehouse_issues WHERE id='${iss}';`)).toBe('true');
    expect(() => sql(as(`SELECT warehouse_issue('${key()}','${u}','${WHA}',1,'X','${STRANGER}','2026-11-02',NULL,NULL,'');`))).toThrow(/не является сотрудником/);
    expect(stock(u, WHA)).toBe('3');
  });

  test('reversal needs reason, is linked, single, and cannot drive stock negative', () => {
    const iss = scalar(`SELECT i.id FROM warehouse_issues i JOIN warehouse_units u ON u.id=i.unit_id WHERE u.name='Перчатки';`);
    const u = scalar(`SELECT unit_id FROM warehouse_issues WHERE id='${iss}';`);
    const ret = scalar(`SELECT id FROM warehouse_issue_returns WHERE issue_id='${iss}' AND condition='good';`);
    const use = scalar(`SELECT id FROM warehouse_issue_usages WHERE issue_id='${iss}' AND kind='consume';`);
    expect(() => sql(as(`SELECT warehouse_reverse_operation('${key()}','usage','${use}','');`))).toThrow(/причину/);
    sql(as(`SELECT warehouse_reverse_operation('${key()}','usage','${use}','ошибочно списали');`));
    expect(issueRow(iss)).toBe('10/3/1/0');
    expect(() => sql(as(`SELECT warehouse_reverse_operation('${key()}','usage','${use}','ещё раз');`))).toThrow(/уже исправлена/);
    // Move the returned 2 away, then reversal of that return must fail (subsequent movement).
    sql(as(`SELECT simple_warehouse_operation('${key()}','${u}','move','${WHB}','${WHA}',2,'',NULL,NULL,NULL);`));
    expect(() => sql(as(`SELECT warehouse_reverse_operation('${key()}','return','${ret}','ошибка возврата');`))).toThrow(/последующие движения/);
    expect(stock(u, WHB)).toBe('0');
    sql(as(`SELECT simple_warehouse_operation('${key()}','${u}','move','${WHA}','${WHB}',2,'',NULL,NULL,NULL);`));
    sql(as(`SELECT warehouse_reverse_operation('${key()}','return','${ret}','ошибка возврата');`));
    expect(stock(u, WHB)).toBe('0');
    expect(issueRow(iss)).toBe('10/1/1/0');
    expect(scalar(`SELECT count(*) FROM warehouse_issue_returns WHERE issue_id='${iss}';`)).toBe('3');
  });

  test('archive blocks with stock, archived warehouse rejects movements, history kept', () => {
    expect(() => sql(as(`SELECT set_warehouse_archived('${WHA}',true);`))).toThrow(/остатки/);
    expect(() => sql(as(`UPDATE warehouses SET archived_at=now() WHERE id='${WHB}';`))).toThrow(/проверку/);
    const empty = scalar(as(`INSERT INTO warehouses(organization_id,name) VALUES('${ORG}','Временный') RETURNING id;`));
    expect(() => sql(as(`SELECT set_warehouse_archived('${empty}',true);`, WORKER))).toThrow(/доступа/);
    sql(as(`SELECT set_warehouse_archived('${empty}',true);`));
    expect(() => sql(as(`SELECT manual_warehouse_receipt('${key()}','${empty}','Ключ','batch',1,'шт',NULL,NULL);`))).toThrow(/архиве/);
    const u = scalar(`SELECT id FROM warehouse_units WHERE name='Перчатки';`);
    expect(() => sql(as(`SELECT simple_warehouse_operation('${key()}','${u}','move','${WHA}','${empty}',1,'',NULL,NULL,NULL);`))).toThrow(/архиве/);
    expect(() => sql(partial(key(), `[{"accepted":1,"unit":"комплект"}]`, true, REQ0, empty))).toThrow(/архиве/);
    sql(as(`SELECT set_warehouse_archived('${empty}',false);`));
    expect(scalar(`SELECT archived_at IS NULL FROM warehouses WHERE id='${empty}';`)).toBe('t');
  });

  test('inventory: uncounted lines untouched, stale snapshot blocked, posted once and immutable', async () => {
    const r = scalar(as(`SELECT manual_warehouse_receipt('${key()}','${WHB}','Каска','batch',7,'шт',NULL,NULL)->>'document_id';`));
    const helmet = scalar(`SELECT unit_id FROM warehouse_document_lines WHERE document_id='${r}';`);
    const gloves = scalar(`SELECT id FROM warehouse_units WHERE name='Перчатки';`);
    const glovesB = stock(gloves, WHB);
    const inv = scalar(as(`SELECT start_warehouse_inventory('${WHB}')->>'id';`));
    expect(scalar(as(`SELECT start_warehouse_inventory('${WHB}')->>'already';`))).toBe('true');
    sql(as(`SELECT set_inventory_count('${inv}','${helmet}',5,'');`));
    expect(() => sql(as(`SELECT post_warehouse_inventory('${inv}',true);`))).toThrow(/причину/);
    sql(as(`SELECT set_inventory_count('${inv}','${helmet}',5,'Недостача при пересчёте');`));
    expect(() => sql(as(`SELECT post_warehouse_inventory('${inv}',false);`))).toThrow(/Подтвердите/);
    // Draft does not change stock.
    expect(stock(helmet, WHB)).toBe('7');
    // Movement after snapshot -> stale.
    sql(as(`SELECT simple_warehouse_operation('${key()}','${helmet}','move','${WHB}','${WHA}',1,'',NULL,NULL,NULL);`));
    expect(() => sql(as(`SELECT post_warehouse_inventory('${inv}',true);`))).toThrow(/пересчитайте/);
    expect(scalar(as(`SELECT refresh_warehouse_inventory('${inv}')->>'recount';`))).toBe('1');
    expect(scalar(`SELECT counted_qty IS NULL FROM warehouse_inventory_lines WHERE inventory_id='${inv}' AND unit_id='${helmet}';`)).toBe('t');
    sql(as(`SELECT set_inventory_count('${inv}','${helmet}',4,'Недостача при пересчёте');`));
    const [a, b] = await Promise.all([run(as(`SELECT post_warehouse_inventory('${inv}',true);`)), run(as(`SELECT post_warehouse_inventory('${inv}',true);`))]);
    expect(a.code + b.code).toBe(0);
    expect(stock(helmet, WHB)).toBe('4');
    expect(stock(gloves, WHB)).toBe(glovesB); // uncounted stays as is
    expect(() => sql(as(`SELECT set_inventory_count('${inv}','${helmet}',3,'x');`))).toThrow(/не редактируется/);
    expect(scalar(`SELECT count(*) FROM warehouse_ledger WHERE operation='inventory' AND unit_id='${helmet}';`)).toBe('1');
    expect(() => sql(as(`SELECT start_warehouse_inventory('${WHB}');`, STRANGER))).toThrow(/доступа/);
    expect(scalar(as(`SELECT count(*) FROM warehouse_inventories;`, STRANGER))).toBe('0');
  });

  test('other organization sees nothing and cannot receive', () => {
    expect(scalar(as(`SELECT count(*) FROM warehouse_receipt_batches;`, STRANGER))).toBe('0');
    expect(() => sql(partial(key(), `[{"item_id":"${ITEM}","accepted":1,"unit":"шт"}]`, true, REQ, WHA, STRANGER))).toThrow(/доступа/);
    expect(() => sql(partial(key(), `[{"accepted":1,"unit":"комплект"}]`, true, REQ0, WHF))).toThrow(/другой организации/);
  });
});
