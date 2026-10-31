import { describe, expect, test } from 'bun:test';
import { receiptDraft, validReceiptLines, RECEIPT_UNITS, type ReceiptLine } from '../src/lib/receiptDraft';
describe('Receipt form',()=>{
 test('no items: request title, empty quantity (never silent 1), default unit шт',()=>{expect(receiptDraft([],'Рации на участок')).toEqual([{id:null,name:'Рации на участок',quantity:'',unit:'шт',kind:'batch'}]);expect(validReceiptLines(receiptDraft([],'Рации на участок'))).toBe(false);});
 test('units are exactly Шт and Комплект with canonical values',()=>{expect(RECEIPT_UNITS.map(u=>[u.value,u.label])).toEqual([['шт','Шт'],['комплект','Комплект']]);});
 test('quantity must be positive; other units rejected',()=>{const [line]=receiptDraft([],'Рации');if(!line)throw Error('line missing');expect(validReceiptLines([{...line,quantity:0}])).toBe(false);expect(validReceiptLines([{...line,quantity:-2}])).toBe(false);expect(validReceiptLines([{...line,quantity:3,unit:'кг'} as unknown as ReceiptLine])).toBe(false);expect(validReceiptLines([{...line,quantity:3,unit:'комплект'}])).toBe(true);});
 test('existing positions used, always single quantity position',()=>{expect(receiptDraft([{id:'i',name:'Болты',quantity:12}],'Заявка')[0]).toEqual({id:'i',name:'Болты',quantity:12,unit:'шт',kind:'batch'});});
});
