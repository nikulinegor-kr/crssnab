/** Select the Russian word form for a numeric count. */
export function pluralRu(n: number, [one, few, many]: readonly [string, string, string]): string {
  const value = Math.abs(Math.trunc(n));
  const hundred = value % 100;
  const ten = value % 10;
  if (hundred >= 11 && hundred <= 14) return many;
  if (ten === 1) return one;
  if (ten >= 2 && ten <= 4) return few;
  return many;
}