// Brácha refill order (spec 5.4).
import { describe, it, expect } from 'vitest';
import { refillItems, refillOrderText } from '../src/domain/refill.js';

const consumables = [
  { id: 'a', name: 'Gaffa černá', state: 2, minThreshold: 6, unit: 'rolí' },
  { id: 'b', name: 'Baterie AA', state: 1, unit: 'ks' },
  { id: 'c', name: 'Kolíčky', state: 0 },
  { id: 'd', name: 'Alobal' }, // no state = OK
];

describe('objednávka doplnění', () => {
  it('chybějící první, 50 % volitelně, OK nikdy', () => {
    expect(refillItems(consumables).map((i) => [i.id, i.urgent])).toEqual([['a', true], ['b', false]]);
    expect(refillItems(consumables, { includeHalf: false }).map((i) => i.id)).toEqual(['a']);
  });

  it('text objednávky s minimem, sekcemi a odesílatelem', () => {
    const text = refillOrderText(refillItems(consumables), { by: 'Petr', date: new Date('2026-11-14T10:00:00') });
    expect(text).toContain('Objednávka doplnění – kufr Brácha (14. 11. 2026)');
    expect(text).toContain('CHYBÍ – doplnit:\n• Gaffa černá (min. 6 rolí)');
    expect(text).toContain('DOCHÁZÍ (50 %):\n• Baterie AA');
    expect(text).toContain('Odeslal: Petr');
  });

  it('nic k doplnění', () => {
    expect(refillOrderText([])).toContain('Nic není potřeba doplnit.');
  });
});
