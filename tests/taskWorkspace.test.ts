import { describe, test, expect } from 'bun:test';
import { taskGroup, quickTaskAcceptance } from '../src/lib/taskWorkspace';
describe('task workspace dates and acceptance',()=>{
  test('groups date-only and timestamp deadlines without moving day across time zones',()=>{
    expect(taskGroup({status:'in_progress',due_date:'2026-11-18T00:00:00Z'},'2026-11-19')).toBe('late');
    expect(taskGroup({status:'review',due_date:'2026-11-19'},'2026-11-19')).toBe('today');
    expect(taskGroup({status:'backlog',due_date:'2026-11-20T00:00:00Z'},'2026-11-19')).toBe('later');
    expect(taskGroup({status:'waiting',due_date:null},'2026-11-19')).toBe('undated');
    expect(taskGroup({status:'done',due_date:'2026-11-18'},'2026-11-19')).toBe('done');
  });
  test('delegated quick task returns to its author for acceptance; self tasks have no self review',()=>{
    expect(quickTaskAcceptance('employee','author')).toEqual({requires_acceptance:true,reviewer_id:'author'});
    expect(quickTaskAcceptance('author','author')).toEqual({requires_acceptance:false,reviewer_id:null});
  });
});
