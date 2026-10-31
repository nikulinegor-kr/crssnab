/** Preserve words, identifiers and semantic pairs on small printed labels. */
export function labelTextGroups(text: string): string[] {
  const words = text.replace(/[\u00ad\u200b]/g, '').trim().split(/\s+/).filter(Boolean);
  const groups: string[] = [];
  const connects = /^(?:в|во|на|и|с|со|к|ко|у|о|об|от|до|по|из|за|для|без|под|над|при|№|ID:)$/i;
  const unit = /^(?:мм|см|м|км|м²|м³|кг|г|т|л|мл|шт\.?|ед\.?)$/i;
  for (let i = 0; i < words.length; i++) {
    let group = words[i];
    while (i + 1 < words.length && connects.test(words[i])) group += ` ${words[++i]}`;
    if (i + 1 < words.length && /^\d+(?:[.,]\d+)?$/.test(words[i]) && unit.test(words[i + 1])) group += ` ${words[++i]}`;
    // Model designations: "BW 141", "ZX 200-3" stay together.
    if (i + 1 < words.length && /^[A-Z]{1,5}$/.test(words[i]) && /^\d[\w./-]*$/.test(words[i + 1])) group += ` ${words[++i]}`;
    groups.push(group);
  }
  return groups;
}

export function wrapLabelText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const rows: string[] = [];
  let row = '';
  for (const group of labelTextGroups(text)) {
    const candidate = row ? `${row} ${group}` : group;
    if (row && measure(candidate) > maxWidth) {
      rows.push(row);
      row = group;
    } else row = candidate;
  }
  if (row) rows.push(row);
  return rows;
}