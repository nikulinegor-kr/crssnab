import { describe, expect, test } from 'bun:test';
import { validateSimpleIssue, warehouseDescription, readWarehouseDescription, warehouseQuantity } from '../src/lib/simpleWarehouse';
describe('Simple warehouse issue rules',()=>{
 test('equipment only is valid',()=>expect(validateSimpleIssue('Иванов','2026-10-31','equipment',null)).toEqual([]));
 test('object only is valid',()=>expect(validateSimpleIssue('Иванов','2026-10-31',null,'object')).toEqual([]));
 test('equipment and object together are rejected',()=>expect(validateSimpleIssue('Иванов','2026-10-31','equipment','object')).toContain('Выберите технику либо объект'));
 test('neither equipment nor object is rejected',()=>expect(validateSimpleIssue('Иванов','2026-10-31',null,null)).toContain('Выберите технику либо объект'));
 test('recipient required',()=>expect(validateSimpleIssue(' ','2026-10-31','equipment',null)).toContain('Укажите получателя'));
 test('issue date required',()=>expect(validateSimpleIssue('Иванов','',null,'object')).toContain('Укажите дату выдачи'));
});
describe('Warehouse directory data',()=>{
 test('optional address and responsible use existing description',()=>expect(readWarehouseDescription(warehouseDescription({address:' Адрес ',responsible:' Иванов '}))).toEqual({address:'Адрес',responsible:'Иванов'}));
 test('existing warehouse descriptions remain readable',()=>expect(readWarehouseDescription('Старый адрес')).toEqual({address:'Старый адрес',responsible:''}));
 test('only the selected warehouse and TMC count toward its balance',()=>expect(warehouseQuantity([{unit_id:'bolts',warehouse_id:'a',quantity:70},{unit_id:'bolts',warehouse_id:'b',quantity:20},{unit_id:'oil',warehouse_id:'a',quantity:50}],'bolts','a')).toBe(70));
 test('empty warehouse balance is zero',()=>expect(warehouseQuantity([{unit_id:'bolts',warehouse_id:'a',quantity:70}],'bolts','empty')).toBe(0));
});
