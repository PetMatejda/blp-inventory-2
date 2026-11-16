import { describe, it, expect } from 'vitest';
import { cleanDisplayName, NAME_MAX } from '../src/domain/displayName.js';

describe('cleanDisplayName', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanDisplayName('  Matěj   Řezňák ')).toEqual({ ok: true, name: 'Matěj Řezňák' });
  });

  it('accepts a nickname', () => {
    expect(cleanDisplayName('Máťa')).toEqual({ ok: true, name: 'Máťa' });
  });

  it('rejects an empty or one-letter name', () => {
    expect(cleanDisplayName('').ok).toBe(false);
    expect(cleanDisplayName('   ').ok).toBe(false);
    expect(cleanDisplayName('M').ok).toBe(false);
    expect(cleanDisplayName(undefined).ok).toBe(false);
  });

  it('rejects a name over the limit', () => {
    expect(cleanDisplayName('a'.repeat(NAME_MAX)).ok).toBe(true);
    expect(cleanDisplayName('a'.repeat(NAME_MAX + 1)).ok).toBe(false);
  });
});
