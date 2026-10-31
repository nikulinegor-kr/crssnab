import { describe, expect, test } from 'bun:test';
import { requestQrAction, shipmentDatesError } from '../src/lib/requestQrWorkflow';
import { qrPayload, parseQrInput } from '../src/lib/warehouseQr';
describe('Permanent request QR workflow', () => {
  test('ready dispatches shipment',()=>expect(requestQrAction('Готов к отгрузке')).toBe('shipment'));
  test('transit dispatches read-only summary',()=>expect(requestQrAction('В пути')).toBe('transit'));
  test('delivered dispatches existing receipt',()=>expect(requestQrAction('Доставлено')).toBe('receipt'));
  test('received takes precedence over status',()=>expect(requestQrAction('Готов к отгрузке',true)).toBe('received'));
  test('other statuses do not dispatch mutations',()=>expect(requestQrAction('В работе')).toBe('details'));
  test('all shipment fields required',()=>expect(shipmentDatesError(null,'2026-10-31','2026-11-01')).not.toBeNull());
  test('arrival cannot precede shipment',()=>expect(shipmentDatesError('ПЭК','2026-10-31','2026-10-30')).not.toBeNull());
  test('same day accepted',()=>expect(shipmentDatesError('ПЭК','2026-10-31','2026-10-31')).toBeNull());
  test('year range enforced',()=>expect(shipmentDatesError('ПЭК','2101-01-01','2101-01-02')).not.toBeNull());
  test('calendar date validated',()=>expect(shipmentDatesError('ПЭК','2026-02-30','2026-03-03')).not.toBeNull());
  test('same payload before and after receiving',()=>{const id='214fcffe-5afa-4c7f-ba21-e91a4e4df34c';expect(qrPayload('request',id)).toBe(`/requests?request=${id}`);expect(parseQrInput(`https://crssnab.com${qrPayload('request',id)}`)).toEqual({kind:'request',token:id});});
});