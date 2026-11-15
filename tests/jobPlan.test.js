import { describe, it, expect } from 'vitest';
import { planJobItems, describePlan } from '../src/domain/jobPlan.js';

const catalog = [
  { id: 'sky', name: 'SkyPanel', category: 'Lights' },
  { id: 'stand', name: 'Stativ', category: 'Grip' },
  { id: 'set', name: 'Set', category: 'Lights', isBundle: true, bundleItems: [{ name: 'SkyPanel', qty: 2 }, { name: 'Stativ', qty: 1 }, { name: 'Pytel písku', qty: 3 }] },
];
const job = { id: 'j', name: 'Job', status: 'ACTIVE', mode: 'LOADING' };
const items = [
  { id: 'i-sky', jobId: 'j', catalogId: 'sky', name: 'SkyPanel', quantityRequested: 1, quantityLoaded: 0, status: 'PENDING' },
  { id: 'i-loaded', jobId: 'j', catalogId: 'stand', name: 'Stativ', quantityRequested: 4, quantityLoaded: 2, status: 'PENDING' },
  { id: 'i-other', jobId: 'x', catalogId: 'sky', name: 'SkyPanel', quantityRequested: 9 },
];
const plan = (lines, extra = {}) => planJobItems({ job, jobItems: items, catalog, lines, ...extra });

describe('planJobItems', () => {
  it('ADD raises the plan of an existing item, SET sets it', () => {
    expect(plan([{ op: 'ADD', catalogId: 'sky', quantity: 2 }]).updates[0].patch.quantityRequested).toBe(3);
    expect(plan([{ op: 'SET', catalogId: 'sky', quantity: 5 }]).updates[0].patch.quantityRequested).toBe(5);
  });

  it('a set adds its parts × quantity, merging with existing items', () => {
    const r = plan([{ op: 'ADD', catalogId: 'set', quantity: 2 }]);
    expect(describePlan(r.changes)).toBe('SkyPanel: 1 → 5 ks, Stativ: 4 → 6 ks, + Pytel písku (6 ks)');
    expect(r.creates[0]).toMatchObject({ jobId: 'j', catalogId: null, name: 'Pytel písku', quantityRequested: 6 });
  });

  it('removes only items with nothing loaded; SET 0 removes too', () => {
    const r = plan([{ op: 'REMOVE', catalogId: 'sky' }, { op: 'REMOVE', catalogId: 'stand' }]);
    expect(r.deletes.map((i) => i.id)).toEqual(['i-sky']);
    expect(r.warnings[0]).toMatch(/naloženo 2 ks/);
    expect(plan([{ op: 'SET', catalogId: 'sky', quantity: 0 }]).deletes).toHaveLength(1);
  });

  it('lowering the plan keeps loaded pieces within it', () => {
    const r = plan([{ op: 'SET', catalogId: 'stand', quantity: 2 }]);
    expect(r.updates[0].patch).toMatchObject({ quantityRequested: 2, quantityLoaded: 2, status: 'LOADED' });
  });

  it('refuses archived jobs and jobs after loading; skips bad lines', () => {
    expect(planJobItems({ job: { ...job, status: 'ARCHIVED' }, lines: [] }).errors).toHaveLength(1);
    expect(planJobItems({ job: { ...job, mode: 'DERIGGING' }, lines: [] }).errors).toHaveLength(1);
    const r = plan([{ op: 'ADD', catalogId: 'nope', quantity: 1 }, { op: 'ADD', catalogId: 'sky', quantity: 0 }, { op: 'SET', catalogId: 'set', quantity: 2 }]);
    expect(r.warnings).toHaveLength(3);
    expect(r.changes).toHaveLength(0);
  });

  it('two lines for a new item end in one created item', () => {
    const r = planJobItems({ job, jobItems: [], catalog, lines: [{ op: 'ADD', catalogId: 'sky', quantity: 2 }, { op: 'ADD', catalogId: 'sky', quantity: 1 }] });
    expect(r.creates).toHaveLength(1);
    expect(r.creates[0].quantityRequested).toBe(3);
  });
});
