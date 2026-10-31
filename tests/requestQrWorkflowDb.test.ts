import { beforeAll, describe, expect, test } from 'bun:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const socket = process.env.LOCAL_WAREHOUSE_TEST_SOCKET;
const suite = socket ? describe : describe.skip;
const db = process.env.LOCAL_QR_TEST_DATABASE;
const args = ['-h',socket ?? '', '-p',process.env.LOCAL_WAREHOUSE_TEST_PORT ?? '55442','-U','lovable','-d',db ?? '', '-X','-q','-v','ON_ERROR_STOP=1','-At'];
function sql(q: string): string {
  if (!socket?.startsWith('/tmp/') || !db?.startsWith('qr_test_')) throw Error('Dedicated disposable QR test database required');
  return execFileSync('psql',args,{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']});
}
const ORG='00000000-0000-0000-0000-0000000000a1', OTHER='00000000-0000-0000-0000-0000000000b2';
const USER='00000000-0000-0000-0000-000000000011', STRANGER='00000000-0000-0000-0000-000000000022';
const WH='00000000-0000-0000-0000-00000000c004';
const id = (n:number) => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const as = (q:string,u=USER) => `BEGIN;SELECT set_config('test.uid','${u}',true); SET LOCAL ROLE authenticated; ${q} COMMIT;`;
const ship = (n:number,carrier="'ПЭК'",start="'2026-10-30'",end="'2026-11-02'",org=ORG) => `SELECT confirm_request_qr_logistics('${id(n)}','${org}','ship',${carrier},${start},${end},NULL);`;
const deliver = (n:number,date="'2026-10-31'") => `SELECT confirm_request_qr_logistics('${id(n)}','${ORG}','deliver',NULL,NULL,NULL,${date});`;
const scalar = (q:string) => sql(q).trim().split('\n').pop();
function concurrent(q:string) { return new Promise<{code:number;out:string}>(resolve=>{const p=spawn('psql',args);let out='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);p.on('close',code=>resolve({code:code??1,out}));p.stdin.end(q);}); }
suite('QR logistics on disposable PostgreSQL',()=>{
  beforeAll(()=>{
    sql(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS transport_company text, ADD COLUMN IF NOT EXISTS shipment_date date, ADD COLUMN IF NOT EXISTS delivery_date date, ADD COLUMN IF NOT EXISTS planned_delivery_date date, ADD COLUMN IF NOT EXISTS actual_arrival_date timestamptz;
    UPDATE user_organizations SET role='editor',is_active=true WHERE user_id='${USER}';
    CREATE OR REPLACE FUNCTION public.user_can_edit_requests(_user_id uuid,_org_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_organizations WHERE user_id=_user_id AND organization_id=_org_id AND is_active AND role IN('owner','admin','editor')) $$;
    CREATE OR REPLACE FUNCTION public.user_can_view_request(u uuid,o uuid,a uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.user_can_edit_requests(u,o) OR (a=u AND public.user_has_org_access(u,o)) $$;
    INSERT INTO requests(id,organization_id,transport_company,description) VALUES('${id(900)}','${ORG}','ПЭК','Справочник тестовой ТК'),('${id(901)}','${OTHER}','Чужая ТК','Чужая организация');
    ${[902,903,904,905,906,907,908,909,910,911,912].map(n=>`INSERT INTO requests(id,organization_id,status,description) VALUES('${id(n)}','${ORG}','Готов к отгрузке','Тест QR ${n}');`).join('\n')}
    CREATE TABLE qr_test_events(request_id uuid,status text);
    CREATE FUNCTION qr_test_notify() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status IS DISTINCT FROM NEW.status THEN INSERT INTO qr_test_events VALUES(NEW.id,NEW.status); END IF; RETURN NEW; END $$;
    CREATE TRIGGER qr_test_notify AFTER UPDATE ON requests FOR EACH ROW EXECUTE FUNCTION qr_test_notify();`);
    sql(readFileSync('drizzle/migrations/0024_receipt_units_sht_komplekt.sql','utf8'));
    sql(readFileSync('drizzle/migrations/0025_confirm_request_qr_logistics.sql','utf8'));
  });
  test('reading/scanning ready does not ship or receive',()=>{expect(scalar(`SELECT status FROM requests WHERE id='${id(902)}';`)).toBe('Готов к отгрузке');expect(scalar(`SELECT count(*) FROM warehouse_request_receipts WHERE request_id='${id(902)}';`)).toBe('0');});
  test('mandatory carrier enforced',()=>expect(()=>sql(as(ship(902,'NULL')))).toThrow(/Укажите ТК/));
  test('mandatory shipment date enforced',()=>expect(()=>sql(as(ship(902,"'ПЭК'",'NULL')))).toThrow(/Укажите ТК/));
  test('mandatory planned arrival enforced',()=>expect(()=>sql(as(ship(902,"'ПЭК'","'2026-10-30'",'NULL')))).toThrow(/Укажите ТК/));
  test('arrival before departure rejected',()=>expect(()=>sql(as(ship(902,"'ПЭК'","'2026-10-30'","'2026-10-29'")))).toThrow(/раньше/));
  test('infinite/year outside range rejected',()=>expect(()=>sql(as(ship(902,"'ПЭК'","'infinity'","'infinity'")))).toThrow(/Проверьте даты/));
  test('carrier must belong to existing organization directory',()=>expect(()=>sql(as(ship(902,"'Чужая ТК'")))).toThrow(/справочника/));
  test('wrong organization rejected',()=>expect(()=>sql(as(ship(902,"'ПЭК'","'2026-10-30'","'2026-11-02'",OTHER)))).toThrow(/Нет доступа/));
  test('foreign actor rejected',()=>expect(()=>sql(as(ship(902),STRANGER))).toThrow(/Нет доступа/));
  test('member without edit permission cannot ship',()=>{sql(`UPDATE user_organizations SET role='member' WHERE user_id='${USER}';`);expect(()=>sql(as(ship(902)))).toThrow(/Нет доступа/);sql(`UPDATE user_organizations SET role='editor' WHERE user_id='${USER}';`);});
  test('invalid calls roll back all fields',()=>expect(scalar(`SELECT concat(status,'|',coalesce(transport_company,''),'|',coalesce(shipment_date::text,'')) FROM requests WHERE id='${id(902)}';`)).toBe('Готов к отгрузке||'));
  test('ship saves ETA separately from actual, without receipt',()=>{sql(as(ship(902)));expect(scalar(`SELECT concat(status,'|',transport_company,'|',shipment_date,'|',planned_delivery_date,'|',actual_arrival_date IS NULL) FROM requests WHERE id='${id(902)}';`)).toBe('В пути|ПЭК|2026-10-30|2026-11-02|t');expect(scalar(`SELECT count(*) FROM warehouse_request_receipts WHERE request_id='${id(902)}';`)).toBe('0');});
  test('repeat confirmation no overwrite or repeated event',()=>{expect(sql(as(ship(902)))).toContain('"already_confirmed": true');expect(()=>sql(as(ship(902,"'ПЭК'","'2026-10-30'","'2026-11-03'")))).toThrow(/только в статусе/);expect(scalar(`SELECT count(*) FROM qr_test_events WHERE request_id='${id(902)}';`)).toBe('1');});
  test('concurrent same confirmations are idempotent',async()=>{const r=await Promise.all([concurrent(as(ship(903))),concurrent(as(ship(903)))]);expect(r.map(x=>x.code)).toEqual([0,0]);expect(scalar(`SELECT count(*) FROM qr_test_events WHERE request_id='${id(903)}';`)).toBe('1');});
  test('concurrent conflicting confirmation cannot overwrite',async()=>{const r=await Promise.all([concurrent(as(ship(904))),concurrent(as(ship(904,"'ПЭК'","'2026-10-30'","'2026-11-03'")))]);expect(r.map(x=>x.code).sort()).toEqual([0,3]);expect(scalar(`SELECT count(*) FROM qr_test_events WHERE request_id='${id(904)}';`)).toBe('1');});
  test('non-ready status cannot ship',()=>{sql(`UPDATE requests SET status='В работе' WHERE id='${id(905)}';`);expect(()=>sql(as(ship(905)))).toThrow(/Готов к отгрузке/);});
  test('delivery requires actual date',()=>expect(()=>sql(as(deliver(902,'NULL')))).toThrow(/фактическую дату/));
  test('actual delivery before shipment rejected',()=>expect(()=>sql(as(deliver(902,"'2026-10-29'")))).toThrow(/не раньше/));
  test('future actual delivery rejected',()=>expect(()=>sql(as(deliver(902,"'2099-01-01'")))).toThrow(/не позже/));
  test('delivery only from transit',()=>{sql(`UPDATE requests SET shipment_date='2026-10-30' WHERE id='${id(906)}';`);expect(()=>sql(as(deliver(906)))).toThrow(/В пути/);});
  test('actual delivery preserves forecast, creates no stock until receipt',()=>{sql(as(deliver(902)));expect(scalar(`SELECT concat(status,'|',delivery_date,'|',planned_delivery_date,'|',(actual_arrival_date AT TIME ZONE 'UTC')::date) FROM requests WHERE id='${id(902)}';`)).toBe('Доставлено|2026-10-31|2026-11-02|2026-10-31');expect(scalar(`SELECT count(*) FROM warehouse_request_receipts WHERE request_id='${id(902)}';`)).toBe('0');});
  test('concurrent delivery confirmations transition once',async()=>{const r=await Promise.all([concurrent(as(deliver(903))),concurrent(as(deliver(903)))]);expect(r.map(x=>x.code)).toEqual([0,0]);expect(scalar(`SELECT count(*) FROM qr_test_events WHERE request_id='${id(903)}' AND status='Доставлено';`)).toBe('1');});
  test('concurrent existing receipt receives exactly once with same QR',async()=>{const call=as(`SELECT receive_warehouse_request('${id(902)}','${WH}','${USER}','[{"item_id":null,"quantity":2,"kind":"batch","unit":"комплект"}]');`);const r=await Promise.all([concurrent(call),concurrent(call)]);expect(r.map(x=>x.code)).toEqual([0,0]);expect(scalar(`SELECT count(*) FROM warehouse_request_receipts WHERE request_id='${id(902)}';`)).toBe('1');expect(scalar(`SELECT sum(b.quantity) FROM warehouse_balances b JOIN warehouse_units u ON b.unit_id=u.id WHERE u.source_request_id='${id(902)}';`)).toBe('2');const token=scalar(`SELECT qr_token FROM warehouse_units WHERE source_request_id='${id(902)}';`);sql(call);expect(scalar(`SELECT qr_token FROM warehouse_units WHERE source_request_id='${id(902)}';`)).toBe(token);expect(()=>sql(as(ship(902)))).toThrow(/Готов к отгрузке/);});
  test('receipt rejects forbidden unit and zero quantity',()=>{sql(as(deliver(904)));expect(()=>sql(as(`SELECT receive_warehouse_request('${id(904)}','${WH}','${USER}','[{"quantity":2,"kind":"batch","unit":"кг"}]');`))).toThrow(/только шт/);expect(()=>sql(as(`SELECT receive_warehouse_request('${id(904)}','${WH}','${USER}','[{"quantity":0,"kind":"batch","unit":"шт"}]');`))).toThrow(/больше нуля/);});
  test('anonymous cannot call RPC',()=>expect(scalar(`SELECT has_function_privilege('anon','public.confirm_request_qr_logistics(uuid,uuid,text,text,date,date,date)','EXECUTE');`)).toBe('f'));
});