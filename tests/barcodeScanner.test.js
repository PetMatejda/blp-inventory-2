// Hardware barcode reader burst detection.
import { describe, it, expect } from 'vitest';
import { createScanBuffer } from '../src/hooks/useBarcodeScanner.js';

const type = (buf, text, start = 0, gap = 10) => {
  let t = start;
  for (const ch of text) { buf.push(ch, t); t += gap; }
  return t;
};

describe('čtečka čárových kódů', () => {
  it('rychlý sled znaků zakončený Enterem je sken', () => {
    const b = createScanBuffer();
    const t = type(b, 'FLT-MOD-001');
    expect(b.push('Enter', t)).toBe('FLT-MOD-001');
  });

  it('pomalé psaní člověka sken nevytvoří', () => {
    const b = createScanBuffer();
    const t = type(b, 'abc', 0, 300);
    expect(b.push('Enter', t)).toBeNull();
  });

  it('pauza uprostřed začne kód znovu; krátký kód se ignoruje', () => {
    const b = createScanBuffer();
    let t = type(b, 'xx');
    t = type(b, 'BLP:cat-1', t + 500);
    expect(b.push('Enter', t)).toBe('BLP:cat-1');
    type(b, 'ab');
    expect(b.push('Enter', 100)).toBeNull();
  });

  it('klávesy jako Shift kód nepřeruší', () => {
    const b = createScanBuffer();
    b.push('Shift', 0); b.push('A', 5); b.push('Shift', 8); b.push('B', 12); b.push('1', 20);
    expect(b.push('Enter', 25)).toBe('AB1');
  });
});
