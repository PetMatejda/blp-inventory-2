// Brácha (consumables): refill order text — spec 5.4 "Objednávka doplnění".
// state: 0 = OK, 1 = 50 % (brzy doplnit), 2 = chybí (doplnit).

export function refillItems(consumables, { includeHalf = true } = {}) {
  return consumables
    .filter((c) => (c.state || 0) === 2 || (includeHalf && (c.state || 0) === 1))
    .map((c) => ({
      id: c.id,
      name: c.name,
      urgent: (c.state || 0) === 2,
      minThreshold: c.minThreshold || null,
      unit: c.unit || 'ks',
    }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.name.localeCompare(b.name, 'cs'));
}

/** Plain text for WhatsApp / e-mail / clipboard. */
export function refillOrderText(items, { by = '', date = new Date() } = {}) {
  const line = (i) => `• ${i.name}${i.minThreshold ? ` (min. ${i.minThreshold} ${i.unit})` : ''}`;
  const urgent = items.filter((i) => i.urgent);
  const half = items.filter((i) => !i.urgent);
  const parts = [`Objednávka doplnění – kufr Brácha (${date.toLocaleDateString('cs-CZ')})`];
  if (urgent.length) parts.push(`\nCHYBÍ – doplnit:\n${urgent.map(line).join('\n')}`);
  if (half.length) parts.push(`\nDOCHÁZÍ (50 %):\n${half.map(line).join('\n')}`);
  if (!items.length) parts.push('\nNic není potřeba doplnit.');
  if (by) parts.push(`\nOdeslal: ${by}`);
  return parts.join('\n');
}
