import { describe, it, expect } from 'vitest';
import { getItemMeta, getCategoryMeta, ITEM_ICONS } from '../src/utils/categoryIcons.jsx';

describe('item icons', () => {
  it('uses the item icon with the category label and colour', () => {
    const meta = getItemMeta({ category: 'Lights', icon: 'cloud' });
    expect(meta.icon).toBe(ITEM_ICONS.find((i) => i.id === 'cloud').icon);
    expect(meta.label).toBe('Světla');
    expect(meta.color).toBe(getCategoryMeta('Lights').color);
  });

  it('falls back to the category icon', () => {
    expect(getItemMeta({ category: 'Cables' }).icon).toBe(getCategoryMeta('Cables').icon);
    expect(getItemMeta({ category: 'Cables', icon: 'unknown' }).icon).toBe(getCategoryMeta('Cables').icon);
  });

  it('knows the Tools category', () => {
    expect(getCategoryMeta('Tools').label).toBe('Nářadí');
    expect(getCategoryMeta('Kits').id).toBe('Kits');
  });
});
