// Handover protocol (spec 6.1): content, escaping and file name.
import { describe, it, expect } from 'vitest';
import { buildProtocolHtml, escapeHtml, summarizeItems, protocolFileName } from '../src/services/pdfService.js';
import { makeJob, makeItem } from './helpers.js';

const items = [
  makeItem({ id: 'a', quantityRequested: 4, quantityLoaded: 4, status: 'LOADED' }),
  makeItem({ id: 'b', name: 'Kabel 25m', quantityRequested: 10, quantityLoaded: 6, status: 'PENDING' }),
  makeItem({ id: 'c', name: 'Balast 1,8k', quantityRequested: 1, quantityLoaded: 1, status: 'DAMAGED', damageSeverity: 'CRITICAL', damageNotes: 'Jiskří' }),
];

describe('předávací protokol', () => {
  it('souhrn počítá kusy a závady', () => {
    expect(summarizeItems(items)).toMatchObject({ totalRequested: 15, totalLoaded: 11, progressPercent: 73 });
    expect(summarizeItems(items).damagedItems).toHaveLength(1);
  });

  it('obsahuje hlavičku zakázky, všechny položky a české stavy', () => {
    const html = buildProtocolHtml(makeJob({ assignedGaffer: 'Jan Novák' }), items, [{ id: 'v1', name: 'Crafter' }]);
    expect(html).toContain('Reklama Test');
    expect(html).toContain('Jan Novák');
    expect(html).toContain('Crafter');
    expect(html).toContain('Kabel 25m');
    expect(html).toContain('Naloženo');
    expect(html).toContain('Kritické (riziko)');
    expect(html).toContain('Jiskří');
    expect(html).not.toContain('>\n            LOADED');
  });

  it('text zadaný uživateli nemůže vložit HTML ani skript', () => {
    const evil = makeItem({ name: '<img src=x onerror=alert(1)>', damageNotes: '<script>x</script>', status: 'DAMAGED' });
    const html = buildProtocolHtml(makeJob({ name: '<b>Job</b>' }), [evil]);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('podpis se vloží jen jako PNG obrázek z plátna', () => {
    const png = 'data:image/png;base64,AAAA';
    expect(buildProtocolHtml(makeJob(), [], [], png)).toContain(`<img src="${png}"`);
    expect(buildProtocolHtml(makeJob(), [], [], 'javascript:alert(1)')).not.toContain('javascript:');
  });

  it('escapeHtml ošetří všechny nebezpečné znaky', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('název souboru je bez diakritiky a mezer', () => {
    const name = protocolFileName(makeJob({ name: 'Reklama Škoda – Den 1' }), new Date('2026-11-14T10:00:00Z'));
    expect(name).toBe('BLP_Protokol_Reklama_Skoda_Den_1_2026-11-14.pdf');
  });
});
