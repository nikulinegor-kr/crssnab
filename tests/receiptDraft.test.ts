import { describe, expect, test } from 'bun:test';
import { receiptDraft, validReceiptLines } from '../src/lib/receiptDraft';
describe('Receipt fallback',()=>{
 test('no items means request title with empty quantity and unit, never silent 1',()=>{expect(receiptDraft([],'Рации на участок')).toEqual([{id:null,name:'Рации на участок',quantity:'',unit:'',kind:'batch'}]);expect(validReceiptLines(receiptDraft([],'Рации на участок'))).toBe(false);});
 test('requires positive quantity and explicit unit',()=>{const [line]=receiptDraft([],'Рации');if(!line)throw Error('line missing');expect(validReceiptLines([{...line,quantity:3,unit:''}])).toBe(false);expect(validReceiptLines([{...line,quantity:0,unit:'шт'}])).toBe(false);expect(validReceiptLines([{...line,quantity:3,unit:'шт'}])).toBe(true);});
 test('existing positions are used rather than fallback',()=>{expect(receiptDraft([{id:'i',name:'Болты',quantity:12}],'Заявка')[0]).toEqual({id:'i',name:'Болты',quantity:12,unit:'шт',kind:'batch'});});
 test('individual pieces require an integer up to 1000',()=>{const base={id:null,name:'Рация',unit:'шт',kind:'item' as const};expect(validReceiptLines([{...base,quantity:1.5}])).toBe(false);expect(validReceiptLines([{...base,quantity:1001}])).toBe(false);expect(validReceiptLines([{...base,quantity:3}])).toBe(true);});
});
