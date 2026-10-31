import { labelTextGroups } from './labelText';

/** Pure label geometry: the canvas renderer and tests share it, so measured bounds are what gets drawn. */
export type Measure = (text: string, font: string) => number;
export type LabelBox = { text: string; font: string; x: number; y: number; width: number; height: number; role: 'title' | 'line' | 'signature-label' | 'signature-name' };
export type LabelLayout = { qr: { x: number; y: number; size: number }; text: { x: number; y: number; width: number; height: number }; boxes: LabelBox[]; signatureRows: number; truncated: boolean };

const FAMILY = 'Manrope, Arial, sans-serif';
export const titleFont = (px: number) => `700 ${px}px ${FAMILY}`;
export const bodyFont = (px: number) => `500 ${px}px ${FAMILY}`;
export const nameFont = (px: number) => `700 ${px}px ${FAMILY}`;

/** "Иванов Иван Иванович" -> "Иванов И.И."; already compact or single-word names stay unchanged. */
export function compactFio(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.slice(1).every(p => /^[A-ZА-ЯЁ]\.(?:[A-ZА-ЯЁ]\.)?$/i.test(p))) return parts.join(' ');
  return `${parts[0]} ${parts.slice(1, 3).map(p => `${p[0].toUpperCase()}.`).join('')}`;
}

/** Break an over-wide single token at natural separators first, then by characters with a visible hyphen. */
function splitToken(token: string, max: number, m: (t: string) => number): string[] {
  const out: string[] = []; let rest = token;
  while (rest && m(rest) > max) {
    let cut = 0;
    for (let i = 1; i < rest.length; i++) { if (m(rest.slice(0, i) + '-') <= max) cut = i; else break; }
    if (cut < 1) cut = 1;
    const sep = Math.max(...['-', '/', '.', '_'].map(s => rest.slice(0, cut).lastIndexOf(s)));
    if (sep >= Math.floor(cut / 2)) { out.push(rest.slice(0, sep + 1)); rest = rest.slice(sep + 1); }
    else { out.push(rest.slice(0, cut) + '-'); rest = rest.slice(cut); }
  }
  if (rest) out.push(rest);
  return out;
}

export function wrapGroups(text: string, max: number, m: (t: string) => number, allowSplit: boolean): string[] | null {
  const rows: string[] = []; let row = '';
  for (const group of labelTextGroups(text)) {
    let pieces = [group];
    if (m(group) > max) {
      const words = group.split(' ');
      if (words.length > 1 && words.every(w => m(w) <= max)) pieces = words;
      else if (!allowSplit) return null;
      else pieces = words.flatMap(w => m(w) > max ? splitToken(w, max, m) : [w]);
    }
    for (const p of pieces) {
      const cand = row ? `${row} ${p}` : p;
      if (row && m(cand) > max) { rows.push(row); row = p; } else row = cand;
    }
  }
  if (row) rows.push(row);
  return rows;
}

function ellipsize(text: string, max: number, m: (t: string) => number) {
  let t = text; while (t && m(`${t}…`) > max) t = t.slice(0, -1).trimEnd();
  return `${t}…`;
}

export function computeLabelLayout(input: { title: string; lines: string[]; applicant?: string | null; receiver?: string | null }, w: number, h: number, measure: Measure): LabelLayout {
  // QR geometry is intentionally unchanged from previous releases.
  const qrSize = Math.min(h - 8, Math.floor(w * 0.48));
  const qr = { x: 0, y: Math.round((h - qrSize) / 2), size: qrSize };
  const padY = Math.round(h * 0.05), padR = Math.round(w * 0.025), gap = Math.round(w * 0.025);
  const text = { x: qrSize + gap, y: padY, width: w - padR - (qrSize + gap), height: h - padY * 2 };
  if (text.width < 60) throw Error('Этикетка слишком узкая для выбранного размера. Выберите большую этикетку.');
  const boxes: LabelBox[] = []; let truncated = false;

  // Signatures: one row each, shared size, shrink to readable minimum, then compact FIO, then explicit ellipsis.
  const people = [['Заявитель:', input.applicant?.trim() || '—'], ['Приёмщик:', input.receiver?.trim() || '—']] as const;
  const minSig = Math.max(14, Math.round(h * 0.045)), maxSig = Math.round(h * 0.068);
  const rowWidth = (label: string, name: string, px: number) => measure(`${label} `, bodyFont(px)) + measure(name, nameFont(px));
  let sig = maxSig, names = people.map(p => p[1]);
  while (sig > minSig && people.some((p, i) => rowWidth(p[0], names[i], sig) > text.width)) sig--;
  if (people.some((p, i) => rowWidth(p[0], names[i], sig) > text.width)) {
    names = names.map(compactFio); sig = maxSig;
    while (sig > minSig && people.some((p, i) => rowWidth(p[0], names[i], sig) > text.width)) sig--;
  }
  names = names.map((n, i) => {
    const room = text.width - measure(`${people[i][0]} `, bodyFont(sig));
    if (measure(n, nameFont(sig)) <= room) return n; truncated = true; return ellipsize(n, room, t => measure(t, nameFont(sig)));
  });
  const sigLine = Math.round(sig * 1.25);
  const sigTop = text.y + text.height - sigLine * 2;
  people.forEach(([label, ], i) => {
    const y = sigTop + i * sigLine, lw = measure(`${label} `, bodyFont(sig));
    boxes.push({ text: label, font: bodyFont(sig), x: text.x, y, width: measure(label, bodyFont(sig)), height: sig, role: 'signature-label' });
    boxes.push({ text: names[i], font: nameFont(sig), x: text.x + lw, y, width: measure(names[i], nameFont(sig)), height: sig, role: 'signature-name' });
  });

  // Extra lines (e.g. "Место 1 из 3") sit just above the signatures.
  const extras = input.lines.map(l => l.trim()).filter(Boolean);
  const lineFont = sig, lineStep = Math.round(lineFont * 1.25);
  const extrasTop = sigTop - Math.round(sig * 0.5) - extras.length * lineStep;
  extras.forEach((t, i) => {
    const fit = measure(t, bodyFont(lineFont)) <= text.width ? t : ellipsize(t, text.width, s => measure(s, bodyFont(lineFont)));
    if (fit !== t) truncated = true;
    boxes.push({ text: fit, font: bodyFont(lineFont), x: text.x, y: extrasTop + i * lineStep, width: measure(fit, bodyFont(lineFont)), height: lineFont, role: 'line' });
  });

  // Title: largest size (capped so short names are not huge) whose word-wrapped rows fit the remaining area.
  const titleBottom = (extras.length ? extrasTop : sigTop) - Math.round(sig * 0.6);
  const avail = titleBottom - text.y, maxTitle = Math.round(h * 0.12), minTitle = Math.max(14, Math.round(h * 0.045));
  let chosen: { px: number; rows: string[] } | null = null;
  for (let pass = 0; pass < 2 && !chosen; pass++) for (let px = maxTitle; px >= minTitle; px--) {
    const rows = wrapGroups(input.title.trim() || '—', text.width, t => measure(t, titleFont(px)), pass === 1);
    if (rows && rows.length * Math.round(px * 1.18) - Math.round(px * 0.18) <= avail) { chosen = { px, rows }; break; }
  }
  if (!chosen) {
    const px = minTitle, step = Math.round(px * 1.18), m = (t: string) => measure(t, titleFont(px));
    const rows = wrapGroups(input.title.trim(), text.width, m, true) ?? [];
    const fit = Math.max(1, Math.floor((avail + Math.round(px * 0.18)) / step));
    chosen = { px, rows: [...rows.slice(0, fit - 1), ellipsize(rows.slice(fit - 1).join(' '), text.width, m)] };
    truncated = true;
  }
  const step = Math.round(chosen.px * 1.18);
  chosen.rows.forEach((t, i) => boxes.push({ text: t, font: titleFont(chosen!.px), x: text.x, y: text.y + i * step, width: measure(t, titleFont(chosen!.px)), height: chosen!.px, role: 'title' }));
  return { qr, text, boxes, signatureRows: 2, truncated };
}
