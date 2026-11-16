import { describe, it, expect } from 'vitest';
import { parseNote } from '../scripts/comsys/notes.mjs';

describe('parseNote (Comsys free-text notes)', () => {
  it('reads condition, LED and the maker number', () => {
    expect(parseNote('Stav: A\nLED: No\nVČ ; 50 / 2016')).toEqual({ condition: 'A', led: false, serialNumber: '50/2016' });
    expect(parseNote('v.č. 4/26\nStav: A\nLED: Yes')).toEqual({ condition: 'A', led: true, serialNumber: '4/2026' });
    expect(parseNote('Stav ; A\nLed , Yes\nVČ ;  3 / 2024')).toEqual({ condition: 'A', led: true, serialNumber: '3/2024' });
    expect(parseNote('Stav: A\nLED: Yes\nPozn: nová\nv.č. 7 .2023').serialNumber).toBe('7/2023');
  });

  it('joins lines wrapped by the report', () => {
    expect(parseNote('Stav: A\nLED: No\nPozn: stínění, bez suchého\nzipu\nVČ ; 10 / 2022'))
      .toEqual({ condition: 'A', led: false, serialNumber: '10/2022', note: 'stínění, bez suchého zipu' });
    expect(parseNote('Pozn: WoT - Letňany,\nStage E')).toEqual({ note: 'WoT - Letňany, Stage E' });
    expect(parseNote('Nefunkční - dočasně\nneopravitelné')).toEqual({ note: 'Nefunkční - dočasně neopravitelné' });
  });

  it('keeps separate remarks separate', () => {
    expect(parseNote('Stav: A\nLED: Yes\nPozn: nová\n3x malá přiruba\nVČ ; 6 / 2023').note).toBe('nová, 3x malá přiruba');
    expect(parseNote('Stav: A\nLED: Yes\n+ malá příruba\nv.č. 1 / 2021').note).toBe('+ malá příruba');
    expect(parseNote('Stav A\nVČ. 12/2023\n1x příruba')).toEqual({ condition: 'A', serialNumber: '12/2023', note: '1x příruba' });
  });

  it('handles the odd ones', () => {
    expect(parseNote('NOVÁ   ´A\nVČ ; 5 / 2024')).toEqual({ condition: 'A', serialNumber: '5/2024', note: 'nová' });
    expect(parseNote('Stav: A\nLED: No  -  A')).toEqual({ condition: 'A', led: false });
    expect(parseNote('Stav: A\nLED: Yes  se zipem').note).toBe('se zipem');
    expect(parseNote('V.č\nStav A')).toEqual({ condition: 'A' });
    expect(parseNote('Stav: B\nLED: Yes\nVČ. S / 2015')).toEqual({ condition: 'B', led: true, serialUnclear: 'S / 2015' });
    expect(parseNote('2x Příruba, LED')).toEqual({ led: true, note: '2x Příruba, LED' });
    expect(parseNote('(Buben)')).toEqual({ note: 'Buben' });
    expect(parseNote('')).toEqual({});
  });
});
