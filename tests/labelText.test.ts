import { describe, expect, test } from 'bun:test';
import { labelTextGroups, wrapLabelText } from '../src/lib/labelText';

describe('label text break rules', () => {
  test('never breaks words or identifiers even when wider than the column', () => {
    expect(wrapLabelText('форсунок REQ-2026-1787640678918', 10, s => s.length)).toEqual(['форсунок', 'REQ-2026-1787640678918']);
  });
  test('keeps prepositions and conjunctions with the following word', () => {
    expect(labelTextGroups('Комплект форсунок на катки BOMAG, пневмоколесный и двухметровый, тяжелый')).toEqual(['Комплект', 'форсунок', 'на катки', 'BOMAG,', 'пневмоколесный', 'и двухметровый,', 'тяжелый']);
  });
  test('keeps values with units and ID with its value', () => {
    expect(labelTextGroups('Труба 20 мм ID: 292aa7ec')).toEqual(['Труба', '20 мм', 'ID: 292aa7ec']);
  });
  test('removes invisible discretionary breaks without losing letters', () => {
    expect(labelTextGroups('фор\u00adсунок пневмо\u200bколесный')).toEqual(['форсунок', 'пневмоколесный']);
  });
});