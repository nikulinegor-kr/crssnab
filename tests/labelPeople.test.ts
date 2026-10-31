import { expect, test } from 'bun:test';
import { labelPeopleLines } from '../src/lib/labelPeople';
test('labels show applicant and actual receiver instead of technical identifiers',()=>{
 expect(labelPeopleLines({applicant:'Иванов Иван',receiver:'Петров Пётр'})).toEqual(['Заявитель: Иванов Иван','Приёмщик: Петров Пётр']);
});
test('missing people are not invented',()=>{
 expect(labelPeopleLines({})).toEqual(['Заявитель: —','Приёмщик: —']);
});