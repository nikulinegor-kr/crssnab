import { beforeAll, describe, expect, test } from 'bun:test';
import { execFileSync, spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
const socket=process.env.LOCAL_WAREHOUSE_TEST_SOCKET;
const suite=socket?describe:describe.skip;
const ORG='00000000-0000-0000-0000-0000000000a1',USER='00000000-0000-0000-0000-000000000011',STRANGER='00000000-0000-0000-0000-000000000022';
const WH='00000000-0000-0000-0000-00000000c004',WH2='00000000-0000-0000-0000-00000000c003',FOREIGN='00000000-0000-0000-0000-00000000c002';
const REQ='00000000-0000-0000-0000-00000000d010',ITEM='00000000-0000-0000-0000-00000000e010',REQ3='00000000-0000-0000-0000-00000000d011',ITEM3='00000000-0000-0000-0000-00000000e011',EQ='00000000-0000-0000-0000-00000000f001';
const args=()=>['-h',socket??'', '-p',process.env.LOCAL_WAREHOUSE_TEST_PORT??'55442','-U','lovable','-d','postgres','-X','-q','-v','ON_ERROR_STOP=1','-At'];
function sql(q:string){if(!socket?.startsWith('/tmp/'))throw Error('Disposable local database required');return execFileSync('psql',args(),{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']});}
const scalar=(q:string)=>sql(q).trim().split('\n').pop()??'';
const as=(q:string,u=USER)=>`BEGIN;SELECT set_config('test.uid','${u}',true);SET LOCAL ROLE authenticated;${q} COMMIT;`;
const receive=(req=REQ,item=ITEM,qty=100,kind='batch',wh=WH)=>`SELECT receive_warehouse_request('${req}','${wh}','${USER}','[{"item_id":"${item}","quantity":${qty},"kind":"${kind}","unit":"шт"}]');`;
const op=(unit:string,key:string,type:string,qty:number,from=WH,to:string|null=WH2,eq:string|null=null,obj:string|null=null)=>`SELECT simple_warehouse_operation('${key}','${unit}','${type}','${from}',${to?`'${to}'`:'NULL'},${qty},'Иванов','2026-10-31',${eq?`'${eq}'`:'NULL'},${obj?`'${obj}'`:'NULL'});`;
const total=(unit:string,wh:string)=>scalar(`SELECT coalesce(sum(quantity),0)::int FROM warehouse_balances WHERE unit_id='${unit}' AND warehouse_id='${wh}';`);
function concurrent(q:string){return new Promise<{code:number,out:string}>(resolve=>{const p=spawn('psql',args());let out='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);p.on('close',code=>resolve({code:code??1,out}));p.stdin.end(q);});}
suite('Simple warehouse on disposable PostgreSQL',()=>{
 let batch='';
 beforeAll(()=>{
  execFileSync('bun',['test','tests/qrWarehouseDb.test.ts'],{env:process.env,stdio:'pipe'});
  sql(`CREATE TABLE user_permissions(user_id uuid,organization_id uuid,permission_key text,allowed boolean);
   CREATE TABLE user_organizations(user_id uuid,organization_id uuid,is_active boolean,role text);
   CREATE OR REPLACE FUNCTION user_has_permission(u uuid,o uuid,k text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT public.user_has_org_access(u,o) AND NOT EXISTS(SELECT 1 FROM public.user_permissions WHERE user_id=u AND organization_id=o AND permission_key=k AND allowed=false) $$;
   INSERT INTO user_organizations SELECT user_id,organization_id,true,'admin' FROM members;
   CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text);INSERT INTO profiles VALUES('${USER}','Тестовый сотрудник');
   CREATE TABLE equipment(id uuid PRIMARY KEY,organization_id uuid,current_object_id uuid);
   CREATE TABLE request_items(id uuid PRIMARY KEY,organization_id uuid,request_id uuid REFERENCES requests(id),name text,quantity integer);
   ALTER TABLE requests ADD COLUMN status text DEFAULT 'Доставлено';ALTER TABLE requests ADD COLUMN applicant_user_id uuid;ALTER TABLE requests ADD COLUMN request_number text DEFAULT 'TEST';
   ALTER TABLE requests ADD COLUMN description text DEFAULT 'Рации на участок';
   ALTER TABLE requests ADD COLUMN product_id uuid;ALTER TABLE requests ADD COLUMN warehouse_id uuid;ALTER TABLE requests ADD COLUMN reserve_on_warehouse boolean;ALTER TABLE requests ADD COLUMN quantity numeric;ALTER TABLE requests ADD COLUMN created_by uuid;
   CREATE TABLE stock_movements(organization_id uuid,product_id uuid,warehouse_id uuid,type text,quantity numeric,request_id uuid,comment text,created_by uuid);
   CREATE FUNCTION user_can_view_request(u uuid,o uuid,a uuid) RETURNS boolean LANGUAGE sql AS $$SELECT user_has_org_access(u,o)$$;
   CREATE FUNCTION user_is_org_admin(u uuid,o uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_organizations WHERE user_id=u AND organization_id=o AND is_active AND role IN ('owner','admin')) $$;
   ALTER TABLE warehouses ADD COLUMN name text DEFAULT 'Склад';ALTER TABLE warehouses ADD COLUMN description text;ALTER TABLE warehouses ADD COLUMN object_id uuid;ALTER TABLE warehouses ALTER COLUMN id SET DEFAULT gen_random_uuid();
   ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users can create org warehouses" ON warehouses FOR INSERT TO authenticated WITH CHECK(user_has_org_access(auth.uid(),organization_id));
   CREATE POLICY "Users can update org warehouses" ON warehouses FOR UPDATE TO authenticated USING(user_has_org_access(auth.uid(),organization_id));
   CREATE POLICY test_wh_select ON warehouses FOR SELECT TO authenticated USING(user_has_org_access(auth.uid(),organization_id));
   GRANT INSERT,UPDATE ON warehouses TO authenticated;
   INSERT INTO warehouses(id,organization_id) VALUES('${WH2}','${ORG}');INSERT INTO equipment VALUES('${EQ}','${ORG}',NULL);
   INSERT INTO requests(id,organization_id) VALUES('${REQ}','${ORG}'),('${REQ3}','${ORG}');
   INSERT INTO request_items VALUES('${ITEM}','${ORG}','${REQ}','Болты',100),('${ITEM3}','${ORG}','${REQ3}','Изделие',3);
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;`);
  const file=readdirSync('drizzle/migrations').find(f=>f.includes('simple_request_warehouse'));
  if(!file)throw Error('Migration missing');sql(readFileSync(`drizzle/migrations/${file}`,'utf8'));
  const guard=readdirSync('drizzle/migrations').find(f=>f.includes('protect_request_receipt_sources'));
  if(!guard)throw Error('Receipt protection missing');sql(readFileSync(`drizzle/migrations/${guard}`,'utf8'));
  const directory=readdirSync('drizzle/migrations').find(f=>f.includes('secure_warehouse_directory'));
  if(!directory)throw Error('Directory protection missing');sql(readFileSync(`drizzle/migrations/${directory}`,'utf8'));
  const fallback=readdirSync('drizzle/migrations').find(f=>f.includes('receipt_fallback_labels'));
  if(!fallback)throw Error('Fallback missing');sql(readFileSync(`drizzle/migrations/${fallback}`,'utf8'));
  for(const name of ['safe_warehouse_delete','preserve_warehouse_delete_admin_access','receipt_for_all_org_members','post_request_receipt_for_members']){const f=readdirSync('drizzle/migrations').find(f=>f.includes(name));if(!f)throw Error(`Migration ${name} missing`);sql(readFileSync(`drizzle/migrations/${f}`,'utf8'));}
 });
 test('creates warehouse with existing fields and enforces name and org isolation',()=>{
  sql(as(`INSERT INTO warehouses(id,organization_id,name,description) VALUES('${WH}','${ORG}',' Новый склад ','Адрес и ответственный');`));
  expect(scalar(as(`SELECT name FROM warehouses WHERE id='${WH}';`))).toBe('Новый склад');
  expect(()=>sql(as(`INSERT INTO warehouses(organization_id,name) VALUES('${ORG}',' ');`))).toThrow(/название/);
  expect(()=>sql(as(`INSERT INTO warehouses(organization_id,name) VALUES('${ORG}','Чужой');`,STRANGER))).toThrow(/row-level security/);
  expect(scalar(as(`SELECT count(*) FROM warehouses WHERE organization_id='${ORG}';`,STRANGER))).toBe('0');
  expect(()=>sql(as(`UPDATE warehouses SET organization_id='00000000-0000-0000-0000-0000000000b2' WHERE id='${WH2}';`))).toThrow(/организац/);
 });
 test('Delivered alone does not create inbound stock',()=>{
  sql(`CREATE TRIGGER test_stock AFTER INSERT OR UPDATE OF status ON requests FOR EACH ROW EXECUTE FUNCTION handle_request_stock_movement();UPDATE requests SET product_id=gen_random_uuid(),warehouse_id='${WH}',quantity=100,status='В пути' WHERE id='${REQ}';UPDATE requests SET status='Доставлено' WHERE id='${REQ}';`);
  expect(scalar(`SELECT count(*) FROM stock_movements WHERE request_id='${REQ}' AND type='IN';`)).toBe('0');
  expect(scalar(`SELECT count(*) FROM warehouse_request_receipts;`)).toBe('0');
 });
 test('edits existing warehouse fields and deletes only unused warehouses',()=>{
  sql(as(`UPDATE warehouses SET name='Переименованный склад',description='Новый адрес' WHERE id='${WH}';`));
  expect(scalar(as(`SELECT name FROM warehouses WHERE id='${WH}';`))).toBe('Переименованный склад');
  const id=scalar(as(`INSERT INTO warehouses(organization_id,name) VALUES('${ORG}','Пустой временный') RETURNING id;`));
  expect(scalar(as(`DELETE FROM warehouses WHERE id='${id}' RETURNING id;`))).toBe(id);
  expect(scalar(`SELECT count(*) FROM warehouses WHERE id='${id}';`)).toBe('0');
  expect(scalar(as(`WITH removed AS(DELETE FROM warehouses WHERE id='${WH}' RETURNING id) SELECT count(*) FROM removed;`,STRANGER))).toBe('0');
  expect(scalar(`SELECT count(*) FROM warehouses WHERE id='${WH}';`)).toBe('1');
 });
 test('rejects non-delivered, excess quantity and foreign warehouse without partial writes',()=>{
  sql(`UPDATE requests SET status='В пути' WHERE id='${REQ}';`);expect(()=>sql(as(receive()))).toThrow(/Доставлено/);
  sql(`UPDATE requests SET status='Доставлено' WHERE id='${REQ}';`);
  expect(()=>sql(as(receive(REQ,ITEM,101)))).toThrow(/превышает/);
  expect(()=>sql(as(receive(REQ,ITEM,100,'batch',FOREIGN)))).toThrow(/другой организации/);
  expect(scalar(`SELECT count(*) FROM warehouse_request_receipts;`)).toBe('0');
 });
 test('100 received, repeat request is idempotent and cannot receive after consumption',()=>{
  sql(as(receive()));batch=scalar(`SELECT id FROM warehouse_units WHERE request_item_id='${ITEM}';`);
  expect(total(batch,WH)).toBe('100');expect(sql(as(receive()))).toContain('"already_received": true');
  expect(total(batch,WH)).toBe('100');expect(()=>sql(`UPDATE request_items SET quantity=200 WHERE id='${ITEM}';`)).toThrow(/нельзя изменять/);
  expect(()=>sql(as(receive(REQ,ITEM,100,'batch',WH2)))).toThrow(/другими параметрами/);
 });
 test('warehouse deletion cannot remove balances, receipts or cascade legacy movements',()=>{
  expect(()=>sql(as(`DELETE FROM warehouses WHERE id='${WH}';`))).toThrow(/Склад используется/);
  expect(total(batch,WH)).toBe('100');
  const id=scalar(as(`INSERT INTO warehouses(organization_id,name) VALUES('${ORG}','Связанный') RETURNING id;`));
  sql(`INSERT INTO stock_movements(organization_id,warehouse_id,quantity,type) VALUES('${ORG}','${id}',1,'IN');ALTER TABLE stock_movements ADD CONSTRAINT test_delete_cascade FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;`);
  expect(()=>sql(as(`DELETE FROM warehouses WHERE id='${id}';`))).toThrow(/Склад используется/);
  expect(scalar(`SELECT count(*) FROM stock_movements WHERE warehouse_id='${id}';`)).toBe('1');
 });
 test('3 individual units receive distinct permanent QR; concurrent request receives once',async()=>{
  const results=await Promise.all([concurrent(as(receive(REQ3,ITEM3,3,'item'))),concurrent(as(receive(REQ3,ITEM3,3,'item')))]);
  expect(results.map(r=>r.code)).toEqual([0,0]);expect(scalar(`SELECT count(DISTINCT qr_token) FROM warehouse_units WHERE request_item_id='${ITEM3}';`)).toBe('3');
  expect(scalar(`SELECT sum(quantity)::int FROM warehouse_balances WHERE unit_id IN(SELECT id FROM warehouse_units WHERE request_item_id='${ITEM3}');`)).toBe('3');
 });
 test('100 -> move 30 -> issue 10 to equipment without object = 70+20; operation retry stable',()=>{
  const key1='00000000-0000-0000-0000-000000000101',key2='00000000-0000-0000-0000-000000000102';
  sql(as(op(batch,key1,'move',30)));sql(as(op(batch,key2,'issue',10,WH2,null,EQ)));
  expect([total(batch,WH),total(batch,WH2)]).toEqual(['70','20']);
  expect(sql(as(op(batch,key2,'issue',10,WH2,null,EQ)))).toContain('"already_posted": true');
  expect(total(batch,WH2)).toBe('20');expect(scalar(`SELECT operation_date FROM warehouse_issues WHERE equipment_id='${EQ}' LIMIT 1;`)).toBe('2026-10-31');
  expect(()=>sql(as(op(batch,'00000000-0000-0000-0000-000000000103','issue',21,WH2,null,EQ)))).toThrow(/Недостаточно/);
 });
 test('issuance requires exactly equipment OR object and records actor/time',()=>{
  expect(()=>sql(as(op(batch,'00000000-0000-0000-0000-000000000104','issue',1,WH2,null)))).toThrow(/технику либо объект/);
  expect(()=>sql(as(op(batch,'00000000-0000-0000-0000-000000000105','issue',1,WH2,null,EQ,EQ)))).toThrow(/технику либо объект/);
  expect(scalar(`SELECT posted_by FROM warehouse_documents WHERE operation_key='00000000-0000-0000-0000-000000000102';`)).toBe(USER);
  expect(scalar(`SELECT count(*) FROM warehouse_ledger WHERE unit_id='${batch}' AND created_by='${USER}' AND created_at IS NOT NULL;`)).toBe('4');
 });
 test('foreign destination move rolls back both warehouse balances',()=>{
  expect(()=>sql(as(op(batch,'00000000-0000-0000-0000-000000000110','move',1,WH,FOREIGN)))).toThrow(/организац/);
  expect([total(batch,WH),total(batch,WH2),total(batch,FOREIGN)]).toEqual(['70','20','0']);
 });
 test('internal trigger functions cannot be called anonymously',()=>{
  expect(scalar(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('warehouse_source_item_guard','warehouse_line_draft_guard','warehouse_request_receipt_guard') AND has_function_privilege('anon',p.oid,'EXECUTE');`)).toBe('0');
 });
 test('concurrent issues cannot make stock negative',async()=>{
  const a=concurrent(as(op(batch,'00000000-0000-0000-0000-000000000106','issue',15,WH2,null,EQ)));
  const b=concurrent(as(op(batch,'00000000-0000-0000-0000-000000000107','issue',15,WH2,null,EQ)));
  const result=await Promise.all([a,b]);expect(result.map(r=>r.code).sort()).toEqual([0,3]);expect(total(batch,WH2)).toBe('5');
 });
 test('foreign organization cannot see receipt or invoke operations',()=>{
  expect(scalar(as(`SELECT count(*) FROM warehouse_request_receipts;`,STRANGER))).toBe('0');
  expect(()=>sql(as(receive(),STRANGER))).toThrow(/Нет доступа/);
  expect(()=>sql(as(op(batch,'00000000-0000-0000-0000-000000000108','move',1),STRANGER))).toThrow(/Нет доступа/);
  expect(()=>sql(as(`INSERT INTO warehouse_request_receipts(organization_id,request_id,document_id,warehouse_id,received_by,receiver_name) VALUES('${ORG}','${REQ}',gen_random_uuid(),'${WH}','${USER}','hack');`))).toThrow();
 });
 test('generic receipt cannot bypass the request receipt flow',()=>{
  const id=scalar(as(`INSERT INTO warehouse_documents(organization_id,doc_type,request_id) VALUES('${ORG}','receipt','${REQ}') RETURNING id;`));
  sql(as(`INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id) VALUES('${ORG}','${id}','${batch}',1,'${WH}');`));
  expect(()=>sql(as(`SELECT post_warehouse_document('${id}');`))).toThrow(/из заявки/);expect(total(batch,WH)).toBe('70');
 });
 test('unlinked generic receipt cannot receive request TMC again',()=>{
  const id=scalar(as(`INSERT INTO warehouse_documents(organization_id,doc_type) VALUES('${ORG}','receipt') RETURNING id;`));
  sql(as(`INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id) VALUES('${ORG}','${id}','${batch}',1,'${WH}');`));
  expect(()=>sql(as(`SELECT post_warehouse_document('${id}');`))).toThrow(/Повторная приёмка/);expect(total(batch,WH)).toBe('70');
 });
 test('fallback requires explicit quantity and unit and rolls back invalid receipt',()=>{
  const req='00000000-0000-0000-0000-00000000d020';sql(`INSERT INTO requests(id,organization_id,description) VALUES('${req}','${ORG}','Рации на участок');`);
  const call=(line:string)=>as(`SELECT receive_warehouse_request('${req}','${WH}','${USER}','[${line}]');`);
  expect(()=>sql(call('{"quantity":null,"kind":"batch","unit":"шт"}'))).toThrow(/количество/);
  expect(()=>sql(call('{"quantity":3,"kind":"batch","unit":""}'))).toThrow(/единицу/);
  expect(scalar(`SELECT count(*) FROM warehouse_documents WHERE request_id='${req}';`)).toBe('0');
  sql(call('{"quantity":2.5,"kind":"batch","unit":"м"}'));
  expect(scalar(`SELECT sum(b.quantity) FROM warehouse_balances b JOIN warehouse_units u ON u.id=b.unit_id WHERE u.source_request_id='${req}';`)).toBe('2.5');
  expect(scalar(`SELECT request_title FROM warehouse_units WHERE source_request_id='${req}';`)).toBe('Рации на участок');
  expect(sql(call('{"quantity":2.5,"kind":"batch","unit":"м"}'))).toContain('"already_received": true');
  expect(()=>sql(call('{"quantity":3,"kind":"batch","unit":"м"}'))).toThrow(/другими параметрами/);
  expect(()=>sql(as(`SELECT receive_warehouse_request('${req}','${WH}','${USER}','[{"quantity":2.5,"kind":"batch","unit":"м"}]');`,STRANGER))).toThrow(/Нет доступа/);
  expect(()=>sql(`INSERT INTO request_items VALUES(gen_random_uuid(),'${ORG}','${req}','Новая позиция',1);`)).toThrow(/нельзя изменять/);
 });
 test('concurrent fallback creates three distinct permanent QR once',async()=>{
  const req='00000000-0000-0000-0000-00000000d021';sql(`INSERT INTO requests(id,organization_id,description) VALUES('${req}','${ORG}','Насосы');`);
  const call=as(`SELECT receive_warehouse_request('${req}','${WH}','${USER}','[{"quantity":3,"kind":"item","unit":"шт"}]');`);
  const result=await Promise.all([concurrent(call),concurrent(call)]);expect(result.map(r=>r.code)).toEqual([0,0]);
  expect(scalar(`SELECT count(DISTINCT qr_token) FROM warehouse_units WHERE source_request_id='${req}';`)).toBe('3');
  const tokens=scalar(`SELECT string_agg(qr_token,',' ORDER BY qr_token) FROM warehouse_units WHERE source_request_id='${req}';`);
  sql(call);expect(scalar(`SELECT string_agg(qr_token,',' ORDER BY qr_token) FROM warehouse_units WHERE source_request_id='${req}';`)).toBe(tokens);
  expect(scalar(`SELECT sum(quantity)::int FROM warehouse_balances WHERE unit_id IN(SELECT id FROM warehouse_units WHERE source_request_id='${req}');`)).toBe('3');
  const u=scalar(`SELECT id FROM warehouse_units WHERE source_request_id='${req}' LIMIT 1;`);
  const doc=scalar(as(`INSERT INTO warehouse_documents(organization_id,doc_type) VALUES('${ORG}','receipt') RETURNING id;`));
  sql(as(`INSERT INTO warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id) VALUES('${ORG}','${doc}','${u}',1,'${WH}');`));
  expect(()=>sql(as(`SELECT post_warehouse_document('${doc}');`))).toThrow(/уже числится/);
 });
 test('fallback cannot bypass existing positions or foreign warehouse',()=>{
  expect(()=>sql(as(`SELECT receive_warehouse_request('${REQ3}','${WH}','${USER}','[{"quantity":1,"kind":"batch","unit":"шт"}]');`))).toThrow(/другими параметрами/);
  const req='00000000-0000-0000-0000-00000000d022';sql(`INSERT INTO requests(id,organization_id,description) VALUES('${req}','${ORG}','Кабель');`);
  expect(()=>sql(as(`SELECT receive_warehouse_request('${req}','${FOREIGN}','${USER}','[{"quantity":1,"kind":"batch","unit":"м"}]');`))).toThrow(/другой организации/);
  expect(scalar(`SELECT count(*) FROM warehouse_request_receipts WHERE request_id='${req}';`)).toBe('0');
 });
 test('employee without warehouse permission is blocked and no roles are changed',()=>{
  sql(`UPDATE user_organizations SET role='member' WHERE user_id='${USER}';INSERT INTO user_permissions VALUES('${USER}','${ORG}','erp.warehouse',false);`);
  expect(()=>sql(as(op(batch,'00000000-0000-0000-0000-000000000109','move',1)))).toThrow(/Нет доступа/);
   expect(()=>sql(as(`INSERT INTO warehouses(organization_id,name) VALUES('${ORG}','Запрещённый склад');`))).toThrow(/row-level security/);
  expect(scalar(as(`WITH removed AS(DELETE FROM warehouses WHERE id='${WH}' RETURNING id) SELECT count(*) FROM removed;`))).toBe('0');
  expect(scalar(`SELECT role FROM user_organizations WHERE user_id='${USER}';`)).toBe('member');
  expect(total(batch,WH)).toBe('70');
 });
 test('any active org member can receive a delivered request',()=>{
  const req='00000000-0000-0000-0000-00000000d023';sql(`INSERT INTO requests(id,organization_id,description) VALUES('${req}','${ORG}','Перчатки');`);
  sql(as(`SELECT receive_warehouse_request('${req}','${WH}','${USER}','[{"quantity":5,"kind":"batch","unit":"пар"}]');`));
  expect(scalar(`SELECT sum(b.quantity)::int FROM warehouse_balances b JOIN warehouse_units u ON u.id=b.unit_id WHERE u.source_request_id='${req}';`)).toBe('5');
  expect(scalar(as(`SELECT count(*) FROM warehouse_request_receipts WHERE request_id='${req}';`))).toBe('1');
  expect(()=>sql(as(`SELECT receive_warehouse_request('${req}','${WH}','${USER}','[{"quantity":5,"kind":"batch","unit":"пар"}]');`,STRANGER))).toThrow(/Нет доступа/);
 });
});
