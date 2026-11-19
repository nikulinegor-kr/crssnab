import { describe, expect, it } from "bun:test";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { validateInvoicePreparationPlan, expandKeepBands, type InvoicePreparationPlan } from "../supabase/functions/_shared/invoicePreparationPlan";
import { prepareInvoicePdf, readPreparedInvoice, insertZrsIntoPreparedInvoice, wrapPdfText } from "../src/lib/invoicePdf";
import { readFile } from "node:fs/promises";

const plan = (pages = 2): InvoicePreparationPlan => ({ version: 1, page_count: pages, complete: true, confidence: .99, pages: Array.from({length:pages},(_,i) => ({ page: i+1, kind: i === pages-1 ? "terms" : "invoice", regions: i === pages-1 ? [] : [{top:0,bottom:.15,kind:"header"},{top:.2,bottom:.55,kind:"items"},{top:.56,bottom:.65,kind:"totals"}], item_indices: i === pages-1 ? [] : [i+1] })) });

describe("invoice preparation completeness", () => {
  it("drops a terms-only second page while accounting for the goods and totals", () => expect(validateInvoicePreparationPlan(plan(),2,1).pages[1].kind).toBe("terms"));
  for (const length of [3,4,5,6]) it(`retains all ${length-1} item pages before a terms-only tail`, () => expect(validateInvoicePreparationPlan(plan(length),length,length-1).pages.filter(p=>p.kind === "invoice")).toHaveLength(length-1));
  it("preserves a separate totals page and split item continuations", () => {
    const value=plan(3); value.pages[1].item_indices=[1]; value.pages[2]={page:3,kind:"invoice",regions:[{top:.1,bottom:.3,kind:"totals"}],item_indices:[]};
    expect(validateInvoicePreparationPlan(value,3,1).pages).toHaveLength(3);
  });
  it.each([
    (p:InvoicePreparationPlan)=>{p.complete=false;},
    (p:InvoicePreparationPlan)=>{p.confidence=.97;},
    (p:InvoicePreparationPlan)=>{p.pages.pop();},
    (p:InvoicePreparationPlan)=>{p.pages[1].kind="unknown";},
    (p:InvoicePreparationPlan)=>{p.pages[0].item_indices=[];},
    (p:InvoicePreparationPlan)=>{p.pages[0].item_indices=[2];},
    (p:InvoicePreparationPlan)=>{p.pages[0].regions[1].bottom=1.1;},
    (p:InvoicePreparationPlan)=>{p.pages[0].regions[1].top=.1;},
    (p:InvoicePreparationPlan)=>{p.pages[0].regions.pop();},
  ])("refuses an unsafe or inconsistent removal plan", change => { const value=plan(); change(value); expect(()=>validateInvoicePreparationPlan(value,2,1)).toThrow(); });
  it("refuses missing rows even when AI claims confidence", () => expect(()=>validateInvoicePreparationPlan(plan(),2,2)).toThrow());
  it("expands crop boundaries to full text lines and merges overlaps", () => expect(expandKeepBands([{top:.2,bottom:.4,kind:"items"},{top:.42,bottom:.5,kind:"totals"}],100,[{top:12,bottom:25},{top:38,bottom:49}])).toEqual([{top:10,bottom:56}]));
  it("wraps long URLs/IDs and every line instead of truncating the second line", () => { const font={widthOfTextAtSize:(s:string)=>s.length}; expect(wrapPdfText("abcdefghi\nabc def ghi",4,font,9)).toEqual(["abcd","efgh","i","abc","def","ghi"]); });
});

describe("prepared PDF and last-sheet ZRS", () => {
  it("builds a derivative without source text/terms and inserts ZRS only on the last retained page", async () => {
    const original=await PDFDocument.create();
    const font=await original.embedFont(StandardFonts.Helvetica);
    for(let i=0;i<4;i++){const page=original.addPage([595,842]);page.drawText(i===3?'PRIVATE CONTRACT TERMS':`GOODS PAGE ${i+1}`,{font,x:20,y:500});}
    // Tiny synthetic raster is enough: tests PDF structure/placement, not copied implementation.
    const png=Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=","base64"));
    const prepared=await prepareInvoicePdf(await original.save(),plan(4),3,async()=>({width:595,height:842,bands:[{png,width:595,height:700}]}));
    expect(prepared.metadata.keptPages).toEqual([1,2,3]);
    expect((await PDFDocument.load(prepared.bytes)).getPageCount()).toBe(3);
    expect((await readPreparedInvoice(prepared.bytes))?.contentBottom).toBe(720);
    const roboto=await readFile(new URL('../public/fonts/Roboto-Regular.ttf',import.meta.url));
    const withZrs=await insertZrsIntoPreparedInvoice(prepared.bytes,Array.from({length:20},()=>"Заявка: длинное описание товара и объекта"),roboto);
    const result=await PDFDocument.load(withZrs);
    expect(result.getPageCount()).toBe(3);
    expect(result.getPage(0).getHeight()).toBe(842);
    expect(result.getPage(2).getHeight()).toBeGreaterThan(842);
    expect(await readPreparedInvoice(withZrs)).toBeNull(); // no reusing a ZRS derivative
    const repeated=await insertZrsIntoPreparedInvoice(prepared.bytes,["Заявка: новая сводка"],roboto);
    expect((await PDFDocument.load(repeated)).getPage(2).getHeight()).toBeLessThan(result.getPage(2).getHeight());
    await expect(insertZrsIntoPreparedInvoice(await original.save(),["test"],roboto)).rejects.toThrow("Сначала");
  });
});
