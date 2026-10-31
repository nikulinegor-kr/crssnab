import { describe, expect, test } from 'bun:test';
import { computeLabelLayout, compactFio, type LabelBox } from '../src/lib/labelLayout';
import { LABEL_SIZE, withPhysicalSize } from '../src/lib/labelPng';
const LABEL_SIZES = [LABEL_SIZE];

// Approximate font metric: width proportional to px, bold wider; real canvas metrics are verified by the PNG script.
const measure = (t: string, f: string) => { const px = Number(/(\d+)px/.exec(f)![1]); return t.length * px * (f.startsWith('700') ? 0.6 : 0.55); };
const CASES = [
  { title: 'Комплект форсунок на катки BOMAG, пневмоколесный и двухметровый, тяжелый', applicant: 'Переведенцев М.Л.', receiver: 'Буравель А.С.' },
  { title: 'Крышка бака водяного, для катка Bomag BW 141', applicant: 'Никулин Е.А.', receiver: 'Буравель А.С.' },
  { title: 'Болты', applicant: 'Иванов И.И.', receiver: 'Петров П.П.' },
  { title: 'Гидрораспределитель', applicant: 'Константинопольский-Преображенский Владимир Александрович', receiver: 'Переведенцева-Кузнецова Анастасия Михайловна' },
  { title: 'Артикул ZX4500-HYD-PMP-998877665544332211-REV-B', applicant: 'Ли А.', receiver: null },
];
const overlap = (a: LabelBox, b: LabelBox) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('label layout bounds', () => {
  for (const size of LABEL_SIZES) for (const c of CASES) test(`${size.width}x${size.height}: ${c.title.slice(0, 24)}`, () => {
    const w = size.width * 12, h = size.height * 12;
    const L = computeLabelLayout({ ...c, lines: [] }, w, h, measure);
    for (const b of L.boxes) {
      expect(b.y).toBeGreaterThanOrEqual(L.qr.y + L.qr.size);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(w);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(h);
    }
    for (let i = 0; i < L.boxes.length; i++) for (let j = i + 1; j < L.boxes.length; j++) expect(overlap(L.boxes[i], L.boxes[j])).toBe(false);
    const sigs = L.boxes.filter(b => b.role === 'signature-label');
    expect(sigs.map(b => b.text)).toEqual(['Заявитель:', 'Приёмщик:']);
    expect(new Set(sigs.map(b => b.y)).size).toBe(2);
    expect(L.boxes.filter(b => b.role === 'signature-name').length).toBe(2);
    const titleBottom = Math.max(...L.boxes.filter(b => b.role === 'title').map(b => b.y + b.height));
    expect(titleBottom).toBeLessThan(Math.min(...sigs.map(b => b.y)));
    expect(L.qr.x + L.qr.size).toBeLessThanOrEqual(w);
  });
  test('model names are never split by letters', () => {
    const L = computeLabelLayout({ ...CASES[1], lines: [] }, 600, 960, measure);
    const text = L.boxes.filter(b => b.role === 'title').map(b => b.text);
    expect(text.some(r => r.includes('BW 141') || r.endsWith('BW'))).toBe(true);
    expect(text.every(r => !r.endsWith('-'))).toBe(true);
  });
  test('short names are not giant', () => {
    const L = computeLabelLayout({ ...CASES[2], lines: [] }, 600, 960, measure);
    expect(L.boxes.find(b => b.role === 'title')!.height).toBeLessThanOrEqual(Math.round(600 * 0.085));
  });
  test('only 50x80 mm (5:8) is exported, with pHYs metadata', () => {
    expect(LABEL_SIZE).toEqual({ width: 50, height: 80 });
    const png = new Uint8Array(33 + 12); png.set([137,80,78,71,13,10,26,10]);
    const out = withPhysicalSize(png, 12000); const v = new DataView(out.buffer);
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe('pHYs');
    expect([v.getUint32(41), v.getUint32(45), out[49]]).toEqual([12000, 12000, 1]);
  });
  test('compact FIO', () => {
    expect(compactFio('Переведенцев Михаил Леонидович')).toBe('Переведенцев М.Л.');
    expect(compactFio('Буравель А.С.')).toBe('Буравель А.С.');
  });
});
