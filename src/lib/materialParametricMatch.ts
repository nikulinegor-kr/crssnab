/**
 * Parametric matching for materials (pipes, rebar, etc.)
 * Extracts type, diameter, thickness from names and matches with tolerance.
 */

import { normalizeForSearch } from "./materialSearch";

export interface MaterialParams {
  type: string | null;       // e.g. "труба", "лист", "арматура"
  diameter: number | null;   // first number (e.g. 159)
  thickness: number | null;  // second number (e.g. 4.5)
  raw: string;               // original normalized name
}

export interface ParametricMatchResult {
  itemId: string;
  itemName: string;
  score: number;
  matchType: "exact" | "fuzzy" | "parametric";
  matchDescription: string | null; // e.g. "25x2.5 → 25x3.0"
  price: number | null;
}

// Known material type keywords (lowercase, normalized)
const TYPE_KEYWORDS: Record<string, string[]> = {
  "труба": ["труба", "трубы", "трубу", "трубой"],
  "лист": ["лист", "листа", "листы", "листов"],
  "арматура": ["арматура", "арматуры", "арматуру"],
  "швеллер": ["швеллер", "швеллера"],
  "уголок": ["уголок", "уголка"],
  "балка": ["балка", "балки"],
  "профиль": ["профиль", "профиля", "профилей"],
  "круг": ["круг", "круга"],
  "полоса": ["полоса", "полосы"],
  "проволока": ["проволока", "проволоки"],
};

/**
 * Normalize dimension separators to 'x'
 * Handles: x, х (Russian), *, ×, inch marks (", "), spaces between numbers
 */
function normalizeDimSeparators(s: string): string {
  return s
    .replace(/х/gi, "x")
    .replace(/[*×]/g, "x")
    // Replace inch marks (ASCII ", curly " ", and ″) followed by space+digit as dimension separator
    .replace(/(\d)["""″]\s*(\d)/g, "$1x$2")
    // Remove standalone inch marks after numbers
    .replace(/(\d)["""″]/g, "$1")
    // Replace comma with dot in numbers
    .replace(/(\d),(\d)/g, "$1.$2")
    // Normalize "NUMBER x NUMBER"
    .replace(/(\d)\s+x\s+(\d)/g, "$1x$2")
    // Two numbers separated only by whitespace (after type word context) → treat as dimensions
    .replace(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/g, (match, a, b, offset, str) => {
      const before = str.substring(Math.max(0, offset - 20), offset).toLowerCase();
      const hasType = Object.values(TYPE_KEYWORDS).flat().some(v => before.includes(v));
      if (hasType) return `${a}x${b}`;
      return match;
    });
}

/**
 * Parse a number that may use comma as decimal separator
 */
function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract material type from name
 */
function extractType(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [type, variants] of Object.entries(TYPE_KEYWORDS)) {
    if (variants.some(v => lower.includes(v))) return type;
  }
  return null;
}

/**
 * Extract dimension parameters from material name.
 * Patterns: "159x4.5", "159х4,5", "25 x 2.5", "Ø159x4.5", '159" 5,0'
 */
function extractDimensions(name: string): { diameter: number | null; thickness: number | null } {
  const norm = normalizeDimSeparators(name);
  
  // Pattern: NUMBERxNUMBER (e.g. 159x4.5)
  const dimMatch = norm.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (dimMatch) {
    return {
      diameter: parseNum(dimMatch[1]),
      thickness: parseNum(dimMatch[2]),
    };
  }

  // Pattern: Ø NUMBER or d=NUMBER followed by optional xNUMBER
  const diaMatch = norm.match(/[Øø]\s*(\d+(?:\.\d+)?)/);
  if (diaMatch) {
    const thickMatch = norm.match(/[Øø]\s*\d+(?:\.\d+)?\s*x\s*(\d+(?:\.\d+)?)/i);
    return {
      diameter: parseNum(diaMatch[1]),
      thickness: thickMatch ? parseNum(thickMatch[1]) : null,
    };
  }

  return { diameter: null, thickness: null };
}

/**
 * Parse material name into structured parameters
 */
export function parseMaterialParams(name: string): MaterialParams {
  const raw = normalizeForSearch(name);
  const type = extractType(name);
  const { diameter, thickness } = extractDimensions(name);
  console.log(`[MaterialParams] "${name}" → type=${type}, diameter=${diameter}, thickness=${thickness}`);
  return { type, diameter, thickness, raw };
}

/**
 * Format dimensions for display
 */
function formatDims(d: number | null, t: number | null): string {
  if (d == null) return "";
  return t != null ? `${d}x${t}` : `${d}`;
}

/**
 * Configurable tolerance for parametric matching
 */
export interface MatchTolerance {
  thicknessMm: number; // ±mm for thickness, default 1
}

const DEFAULT_TOLERANCE: MatchTolerance = { thicknessMm: 1 };

/**
 * Enhanced matching: exact → fuzzy → parametric
 */
export function findBestParametricMatch(
  kpName: string,
  kpUnit: string | null,
  projectItems: Array<{ id: string; name: string; unit: string | null; price: number | null }>,
  tolerance: MatchTolerance = DEFAULT_TOLERANCE,
): ParametricMatchResult | null {
  if (projectItems.length === 0) return null;

  const kpParams = parseMaterialParams(kpName);
  const kpNorm = normalizeForSearch(kpName);
  const kpUnitNorm = normalizeForSearch(kpUnit || "");

  // 1) Exact match (highest priority)
  let bestExact: ParametricMatchResult | null = null;
  for (const item of projectItems) {
    const itemNorm = normalizeForSearch(item.name);
    if (kpNorm !== itemNorm) continue;

    const itemUnitNorm = normalizeForSearch(item.unit || "");
    const score = kpUnitNorm === itemUnitNorm ? 1.0 : 0.95;
    if (!bestExact || score > bestExact.score) {
      bestExact = {
        itemId: item.id,
        itemName: item.name,
        score,
        matchType: "exact",
        matchDescription: null,
        price: item.price,
      };
    }
  }
  if (bestExact) return bestExact;

  // 2) Fuzzy match
  let bestFuzzy: ParametricMatchResult | null = null;
  for (const item of projectItems) {
    const itemNorm = normalizeForSearch(item.name);
    const itemUnitNorm = normalizeForSearch(item.unit || "");

    const kpWords = kpNorm.split(/\s+/).filter(w => w.length > 2);
    const itemWords = itemNorm.split(/\s+/).filter(w => w.length > 2);
    const commonWords = kpWords.filter(w => itemWords.some(iw => iw.includes(w) || w.includes(iw)));
    let fuzzyScore = kpWords.length > 0 ? commonWords.length / kpWords.length : 0;

    const maxLen = Math.max(kpNorm.length, itemNorm.length);
    if (maxLen > 0) {
      const levScore = 1 - levenshteinFast(kpNorm, itemNorm) / maxLen;
      fuzzyScore = Math.max(fuzzyScore, levScore);
    }

    if (kpUnitNorm && itemUnitNorm) {
      if (kpUnitNorm === itemUnitNorm) fuzzyScore = Math.min(1, fuzzyScore + 0.05);
      else if (fuzzyScore > 0.5) fuzzyScore -= 0.05;
    }

    if (fuzzyScore >= 0.6 && (!bestFuzzy || fuzzyScore > bestFuzzy.score)) {
      bestFuzzy = {
        itemId: item.id,
        itemName: item.name,
        score: fuzzyScore,
        matchType: "fuzzy",
        matchDescription: null,
        price: item.price,
      };
    }
  }
  if (bestFuzzy) return bestFuzzy;

  // 3) Parametric match (mandatory fallback when exact/fuzzy not found)
  if (!kpParams.type || kpParams.diameter == null) return null;

  const effectiveTolerance = Math.max(tolerance.thicknessMm, 0.0001);
  let bestParametric: ParametricMatchResult | null = null;

  for (const item of projectItems) {
    const itemParams = parseMaterialParams(item.name);

    if (itemParams.type !== kpParams.type) continue;
    if (itemParams.diameter !== kpParams.diameter) continue;

    let thicknessMatch = false;
    let paramScore = 0.7;

    if (kpParams.thickness != null && itemParams.thickness != null) {
      const diff = Math.abs(kpParams.thickness - itemParams.thickness);
      if (diff === 0) {
        thicknessMatch = true;
        paramScore = 0.85;
      } else if (diff <= effectiveTolerance) {
        thicknessMatch = true;
        paramScore = 0.75 - (diff / effectiveTolerance) * 0.05;
      }
    } else if (kpParams.thickness == null && itemParams.thickness == null) {
      thicknessMatch = true;
      paramScore = 0.72;
    } else {
      thicknessMatch = true;
      paramScore = 0.65;
    }

    if (thicknessMatch && (!bestParametric || paramScore > bestParametric.score)) {
      const desc = `${formatDims(kpParams.diameter, kpParams.thickness)} → ${formatDims(itemParams.diameter, itemParams.thickness)}`;
      bestParametric = {
        itemId: item.id,
        itemName: item.name,
        score: paramScore,
        matchType: "parametric",
        matchDescription: kpParams.thickness !== itemParams.thickness ? desc : null,
        price: item.price,
      };
    }
  }

  if (bestParametric) {
    console.log(`[MaterialParams] PARAM MATCH: ${bestParametric.matchDescription ?? `${formatDims(kpParams.diameter, kpParams.thickness)} → ${bestParametric.itemName}`} → matched`);
  }

  return bestParametric;
}

/**
 * Fast Levenshtein distance (optimized single-row)
 */
function levenshteinFast(a: string, b: string): number {
  const an = a.length, bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  
  let prev = Array.from({ length: bn + 1 }, (_, i) => i);
  let curr = new Array(bn + 1);
  
  for (let i = 1; i <= an; i++) {
    curr[0] = i;
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  
  return prev[bn];
}
