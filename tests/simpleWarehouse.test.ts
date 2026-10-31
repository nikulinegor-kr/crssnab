import { describe, expect, test } from 'bun:test';
import { validateSimpleIssue } from '../src/lib/simpleWarehouse';
describe('Simple warehouse issue rules',()=>{
 test('equipment only is valid',()=>expect(validateSimpleIssue('Иванов','2026-10-31','equipment',null)).toEqual([]));
 test('object only is valid',()=>expect(validateSimpleIssue('Иванов','2026-10-31',null,'object')).toEqual([]));
 test('equipment and object together are rejected',()=>expect(validateSimpleIssue('Иванов','2026-10-31','equipment','object')).toContain('Выберите технику либо объект'));
 test('neither equipment nor object is rejected',()=>expect(validateSimpleIssue('Иванов','2026-10-31',null,null)).toContain('Выберите технику либо объект'));
 test('recipient required',()=>expect(validateSimpleIssue(' ','2026-10-31','equipment',null)).toContain('Укажите получателя'));
 test('issue date required',()=>expect(validateSimpleIssue('Иванов','',null,'object')).toContain('Укажите дату выдачи'));
});
