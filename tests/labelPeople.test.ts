import { expect, test } from 'bun:test';
import { labelPeopleLines, labelVisibleLines } from '../src/lib/labelPeople';
test('labels show applicant and actual receiver instead of technical identifiers',()=>{
 expect(labelPeopleLines({applicant:'Иванов Иван',receiver:'Петров Пётр'})).toEqual(['Заявитель: Иванов Иван','Приёмщик: Петров Пётр']);
});
test('missing people are not invented',()=>{
 expect(labelPeopleLines({})).toEqual(['Заявитель: —','Приёмщик: —']);
});
test('legacy technical identifiers are excluded while inventory metadata remains',()=>{
 expect(labelVisibleLines(['REQ-2026-1787640678918','ID: 292aa7ec','2026-1787640678918','Материал · Шт','Партия P-14'])).toEqual(['Материал · Шт','Партия P-14']);
});