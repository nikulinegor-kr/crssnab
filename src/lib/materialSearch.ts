/**
 * Normalizes a string for fuzzy material search:
 * - lowercase
 * - replace Russian "х" with Latin "x"
 * - replace commas with dots (decimal separators)
 * - strip technical suffixes (ГОСТ, ОСТ, ТУ, etc.)
 * - collapse whitespace
 */
export function normalizeForSearch(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/х/g, "x")           // Russian х → Latin x
    .replace(/,/g, ".")           // comma → dot
    .replace(/\bгост\b[\s\d.\-]*/gi, " ")
    .replace(/\bост\b[\s\d.\-]*/gi, " ")
    .replace(/\bту\b[\s\d.\-]*/gi, " ")
    .replace(/\bсто\b[\s\d.\-]*/gi, " ")
    .replace(/[()«»"']/g, "")    // strip quotes/parens
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a material record matches a search query.
 * Splits query into words and checks that every word appears in the normalized text.
 */
export function matchesMaterialSearch(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  if (!query.trim()) return true;
  const normalizedText = normalizeForSearch(fields.filter(Boolean).join(" "));
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  return words.every(w => normalizedText.includes(w));
}

/**
 * Finds all highlight ranges in `text` that match any word from `query`,
 * using normalized comparison. Returns array of [start, end] in the original text.
 */
export function findHighlightRanges(
  text: string,
  query: string
): [number, number][] {
  if (!text || !query.trim()) return [];
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const ranges: [number, number][] = [];
  const normText = normalizeForSearch(text);

  // Build a char-mapping from normalized positions back to original positions
  // Since normalizeForSearch can change string length, we need a mapping
  // Simplified approach: scan original text char-by-char
  const origLower = text.toLowerCase();

  for (const word of words) {
    // Search in normalized text
    let searchFrom = 0;
    while (true) {
      const idx = normText.indexOf(word, searchFrom);
      if (idx === -1) break;

      // Map normalized index back to approximate original index
      // Since our normalization mostly preserves char positions (1:1 replacements),
      // we can use a direct scan approach
      const origStart = mapNormIndexToOrig(text, idx);
      const origEnd = mapNormIndexToOrig(text, idx + word.length);

      if (origStart !== -1 && origEnd !== -1) {
        ranges.push([origStart, origEnd]);
      }
      searchFrom = idx + 1;
    }
  }

  // Merge overlapping ranges
  if (ranges.length === 0) return [];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) {
      last[1] = Math.max(last[1], ranges[i][1]);
    } else {
      merged.push(ranges[i]);
    }
  }
  return merged;
}

/**
 * Maps an index in the normalized string back to the original string.
 * Our normalization does mostly 1:1 char replacements (х→x, ,→.)
 * and removes certain chars, so we track position by walking both strings.
 */
function mapNormIndexToOrig(original: string, normIdx: number): number {
  // Rebuild normalization step by step, tracking positions
  let ni = 0; // normalized index
  let oi = 0; // original index
  const lower = original.toLowerCase();

  // Replicate normalization logic character-by-character
  // We walk the original and count how many normalized chars we've produced
  const stripped = /[()«»"']/;
  // Handle ГОСТ/ОСТ/ТУ/СТО patterns - for simplicity, we won't skip them in char mapping
  // since they get replaced with space. This is approximate but good enough for highlighting.

  while (oi < original.length && ni < normIdx) {
    const ch = lower[oi];
    if (stripped.test(ch)) {
      // This char is removed in normalization, skip in original
      oi++;
      continue;
    }
    ni++;
    oi++;
  }

  // Handle stripped chars at the target position
  while (oi < original.length && stripped.test(lower[oi])) {
    oi++;
  }

  return oi <= original.length ? oi : -1;
}
