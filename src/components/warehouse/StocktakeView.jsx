import React, { useMemo, useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet, useDialogs } from '../common/Dialogs';
import { CodeInput, downloadText } from '../common/CodeInput';
import { CATEGORIES, getCategoryMeta } from '../../utils/categoryIcons';
import { countedOf, stocktakeResult, toCsv } from '../../domain/stock';
import { plural } from '../../domain/labels';
import { resolveCode } from '../../domain/labels-qr';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { ClipboardCheck, CheckCircle2, Eye, EyeOff, Download, X, Tag, ChevronRight } from 'lucide-react';
import { matchesSearch, SEARCH_INPUT_PROPS } from '../../domain/search';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

/** Units of a labelled item: tick found units, add unlabelled pieces. */
const SerialLineSheet = ({ line, onClose }) => {
  const { stockUnits, stock } = useInventory();
  const { askNumber } = useDialogs();
  const units = stockUnits.filter((u) => u.catalogId === line.catalogId && u.status !== 'RETIRED');
  const scanned = new Set(line.scannedUnitIds || []);
  return (
    <Sheet title={line.name} subtitle={`Napočítáno ${countedOf(line)} ks`} onClose={onClose}>
      <ul className="flex flex-col gap-1.5">
        {units.length === 0 && <li className="text-sm text-on-surface-variant">Žádný kus nemá štítek — počítejte ručně níže.</li>}
        {units.map((u) => (
          <li key={u.id}>
            <label className="flex items-center gap-3 min-h-[48px] px-3 rounded-xl border border-outline-variant">
              <input type="checkbox" className="w-6 h-6" checked={scanned.has(u.id)} onChange={(e) => stock.toggleUnitInLine(line.id, u.id, e.target.checked)} />
              <span className="font-mono text-base flex-1">{u.code}</span>
              {u.status === 'IN_SERVICE' && <span className="text-xs text-tertiary">v servisu</span>}
            </label>
          </li>
        ))}
      </ul>
      <button
        onClick={async () => { const n = await askNumber({ title: line.name, message: 'Kusy bez štítku (počítané ručně)', value: line.extraCount || 0 }); if (n != null) stock.setLineExtra(line.id, n); }}
        className="h-14 rounded-2xl border border-outline-variant bg-surface-container text-base font-semibold"
      >
        Kusy bez štítku: {line.extraCount || 0}
      </button>
    </Sheet>
  );
};

const ResultSheet = ({ stocktake, lines, onClose }) => {
  const { stock } = useInventory();
  const { confirm, toast } = useDialogs();
  const result = stocktakeResult(lines);

  const exportCsv = () => downloadText(
    `BLP_inventura_${(stocktake.startedAt || '').slice(0, 10)}.csv`,
    toCsv(lines, [
      { label: 'Položka', value: 'name' },
      { label: 'Kategorie', value: (l) => getCategoryMeta(l.category).label },
      { label: 'Očekáváno', value: 'expected' },
      { label: 'Napočítáno', value: (l) => countedOf(l) ?? '' },
      { label: 'Rozdíl', value: (l) => (countedOf(l) == null ? '' : countedOf(l) - l.expected) },
      { label: 'Počítal', value: 'countedBy' },
    ]),
  );

  const approve = async () => {
    const msg = `${result.differences.length} ${plural(result.differences.length, 'rozdíl se zapíše', 'rozdíly se zapíšou', 'rozdílů se zapíše')} do skladu.`
      + (result.notCounted.length ? `\n\n${result.notCounted.length} ${plural(result.notCounted.length, 'položka nebyla spočítána', 'položky nebyly spočítány', 'položek nebylo spočítáno')} a zůstane beze změny.` : '');
    if (!(await confirm({ title: 'Schválit inventuru?', message: msg, confirmLabel: 'Schválit a srovnat sklad' }))) return;
    stock.approveStocktake(stocktake.id);
    onClose();
    toast({ text: 'Inventura schválena, sklad srovnán' });
  };

  return (
    <Sheet title="Vyhodnocení inventury" subtitle={`Zahájeno ${fmt(stocktake.startedAt)}`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-outline-variant bg-surface-container p-3"><div className="text-2xl font-bold">{result.matching}</div><div className="text-xs text-on-surface-variant">sedí</div></div>
        <div className={`rounded-xl border p-3 ${result.differences.length ? 'border-error/40 bg-error-container/20' : 'border-outline-variant bg-surface-container'}`}><div className="text-2xl font-bold">{result.differences.length}</div><div className="text-xs text-on-surface-variant">rozdíly</div></div>
        <div className="rounded-xl border border-outline-variant bg-surface-container p-3"><div className="text-2xl font-bold">{result.notCounted.length}</div><div className="text-xs text-on-surface-variant">nespočítáno</div></div>
      </div>
      {result.differences.length > 0 && (
        <ul className="text-sm divide-y divide-outline-variant/50 border border-outline-variant rounded-xl px-3">
          {result.differences.map((d) => (
            <li key={d.catalogId} className="py-2 flex justify-between gap-2">
              <span className="text-on-surface">{d.name}</span>
              <span className={`font-mono font-bold shrink-0 ${d.diff < 0 ? 'text-error' : 'text-secondary'}`}>{d.expected} → {d.counted} ({d.diff > 0 ? '+' : ''}{d.diff})</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        <button onClick={exportCsv} className="h-12 rounded-2xl border border-outline-variant bg-surface-container font-semibold flex items-center justify-center gap-2"><Download className="w-5 h-5" /> Export CSV</button>
        <button onClick={approve} className="h-14 rounded-2xl bg-secondary text-on-secondary text-base font-bold shadow">Schválit a srovnat sklad</button>
      </div>
    </Sheet>
  );
};

const LINE_FILTERS = [
  { id: 'TODO', label: 'Nespočítané' },
  { id: 'DONE', label: 'Spočítané' },
  { id: 'ALL', label: 'Vše' },
];

export const StocktakeView = () => {
  const { stocktakes, stocktakeLines, stock, stockLevels, catalog, stockUnits } = useInventory();
  const { askNumber, confirm, toast } = useDialogs();
  const [category, setCategory] = useState('ALL');
  const [filter, setFilter] = useState('TODO');
  const [showExpected, setShowExpected] = useState(false);
  const [serialLine, setSerialLine] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [query, setQuery] = useState('');

  const open = stocktakes.find((s) => s.status === 'OPEN');
  const lines = useMemo(() => (open ? stocktakeLines.filter((l) => l.stocktakeId === open.id) : []), [open, stocktakeLines]);
  const isCounted = (l) => (l.tracking === 'SERIAL' ? !!l.touched || countedOf(l) > 0 : countedOf(l) !== null);

  // Hardware barcode reader: unit label → counted; item label / EAN → enter the count.
  useBarcodeScanner(async (code) => {
    const r = resolveCode(code, { jobItems: [], catalog, units: stockUnits });
    if (r.kind === 'UNIT') {
      const res = stock.scanUnitCode(open.id, code);
      toast({ text: res.ok ? (res.duplicate ? `Už započítáno: ${res.message}` : `✓ ${res.message}`) : `✗ ${res.message}` });
      return;
    }
    const line = r.kind === 'CATALOG' ? lines.find((l) => l.catalogId === r.catalogItem.id) : null;
    if (!line) { toast({ text: `✗ ${r.kind === 'CATALOG' ? `${r.catalogItem.name} není v této inventuře` : `Neznámý kód ${code}`}` }); return; }
    if (line.tracking === 'SERIAL') { setSerialLine(line.id); return; }
    const n = await askNumber({ title: line.name, message: 'Napočítáno ve skladu', value: countedOf(line) ?? 0 });
    if (n != null) stock.countLine(line.id, n);
  }, { enabled: !!open && !serialLine && !showResult });

  if (stockLevels.length === 0) {
    return <p className="text-base text-on-surface-variant p-4 text-center">Nejdřív založte stav skladu v záložce „Stav“.</p>;
  }

  // ── No open stocktake: start one + history ──
  if (!open) {
    const history = stocktakes.filter((s) => s.status !== 'OPEN').slice(0, 10);
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-card-bg border border-outline-variant rounded-2xl p-4 flex flex-col gap-3">
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-primary" /> Nová inventura</h3>
          <p className="text-sm text-on-surface-variant">Spočítejte, co je fyzicky ve skladu. Počítat může víc lidí najednou, každý jinou část. Technika na zakázkách se nepočítá.</p>
          <label className="text-sm font-semibold text-on-surface">Rozsah
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full h-12 rounded-xl border border-outline-variant bg-card-bg px-3 text-base">
              <option value="ALL">Celý sklad</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <button
            onClick={() => { const id = stock.startStocktake({ category }); if (id) toast({ text: 'Inventura zahájena' }); }}
            className="h-14 rounded-2xl bg-primary text-on-primary text-base font-bold"
          >
            Zahájit inventuru
          </button>
        </div>
        {history.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-on-surface mb-2">Předchozí inventury</h3>
            <ul className="flex flex-col gap-2">
              {history.map((s) => (
                <li key={s.id} className="bg-card-bg border border-outline-variant rounded-xl p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-on-surface">{fmt(s.startedAt)} · {s.category === 'ALL' ? 'celý sklad' : getCategoryMeta(s.category).label}</span>
                    <span className={s.status === 'APPROVED' ? 'text-secondary font-semibold' : 'text-on-surface-variant'}>{s.status === 'APPROVED' ? 'Schváleno' : 'Zrušeno'}</span>
                  </div>
                  {s.summary && <p className="text-on-surface-variant">Rozdíly: {s.summary.differences} · sedí: {s.summary.matching} · nespočítáno: {s.summary.notCounted} · {s.approvedBy}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── Counting ──
  const counted = lines.filter(isCounted).length;
  const q = query.trim();
  const visible = lines.filter((l) => {
    if (q) return matchesSearch(l.name, q);
    if (filter === 'TODO') return !isCounted(l);
    if (filter === 'DONE') return isCounted(l);
    return true;
  });

  // viaCamera: the full-screen scanner shows the result itself (no toast on top of it).
  const onCode = (code, viaCamera = false) => {
    const r = stock.scanUnitCode(open.id, code);
    if (!viaCamera) {
      toast({ text: r.ok ? (r.duplicate ? `Už započítáno: ${r.message}` : `✓ ${r.message}`) : `✗ ${r.message}` });
      if (navigator.vibrate && !r.ok) navigator.vibrate([80, 60, 80]);
    }
    if (!r.ok) return { type: 'error', text: r.message, detail: code };
    return { type: r.duplicate ? 'ask' : 'success', text: r.duplicate ? `Už započítáno: ${r.message}` : r.message, detail: code };
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-card-bg border border-primary/40 rounded-2xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-on-surface">Probíhá inventura</span>
          <span className="text-sm font-mono font-bold">{counted}/{lines.length}</span>
        </div>
        <div className="h-3 bg-surface-container-highest rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${lines.length ? (counted / lines.length) * 100 : 0}%` }} />
        </div>
        <p className="text-xs text-on-surface-variant">Zahájil {open.startedBy} · {fmt(open.startedAt)}</p>
      </div>

      <CodeInput placeholder="Naskenujte štítek kusu (světla, balasty)" onCode={onCode} autoFocus={false} scannerTitle="Skener · inventura" />

      <div className="flex gap-2 items-center">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat položku…" {...SEARCH_INPUT_PROPS}
          className="flex-1 h-11 px-3 bg-card-bg border border-outline-variant rounded-xl text-base" />
        <button onClick={() => setShowExpected((v) => !v)} className="h-11 px-3 rounded-xl border border-outline-variant bg-card-bg text-sm flex items-center gap-1.5"
          aria-pressed={showExpected} title="Počítání naslepo je přesnější">
          {showExpected ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showExpected ? 'Skrýt stav' : 'Ukázat stav'}
        </button>
      </div>

      {!q && (
        <div className="flex gap-2" role="tablist">
          {LINE_FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={`h-11 px-4 rounded-xl text-sm font-semibold border ${filter === f.id ? 'bg-primary text-on-primary border-primary' : 'bg-card-bg border-outline-variant text-on-surface-variant'}`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {visible.length === 0 && (
          <li className="bg-card-bg border border-secondary/40 rounded-2xl p-5 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-10 h-10 text-secondary" />
            <span className="font-semibold">{filter === 'TODO' ? 'Vše spočítáno' : 'Nic tu není'}</span>
          </li>
        )}
        {visible.map((l) => {
          const c = countedOf(l);
          const done = isCounted(l);
          const diff = done && c !== null ? c - l.expected : 0;
          return (
            <li key={l.id}>
              <button
                onClick={async () => {
                  if (l.tracking === 'SERIAL') { setSerialLine(l.id); return; }
                  const n = await askNumber({ title: l.name, message: 'Napočítáno ve skladu', value: c ?? 0 });
                  if (n != null) stock.countLine(l.id, n);
                }}
                className={`w-full text-left bg-card-bg border rounded-2xl p-3 flex items-center gap-3 ${done ? 'border-secondary/40' : 'border-outline-variant'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-on-surface leading-snug">{l.name}</p>
                  <p className="text-sm text-on-surface-variant">
                    {l.tracking === 'SERIAL' && <><Tag className="w-3.5 h-3.5 inline mr-1" />po kusech · </>}
                    {getCategoryMeta(l.category).label}
                    {showExpected && <> · systém {l.expected}</>}
                    {done && showExpected && diff !== 0 && <span className={diff < 0 ? 'text-error font-semibold' : 'text-secondary font-semibold'}> ({diff > 0 ? '+' : ''}{diff})</span>}
                  </p>
                </div>
                <div className="text-right shrink-0 min-w-[56px]">
                  <div className={`text-2xl font-bold font-mono ${done ? 'text-on-surface' : 'text-outline'}`}>{done ? c : '–'}</div>
                  <div className="text-xs text-on-surface-variant">{done ? 'ks' : 'spočítat'}</div>
                </div>
                {l.tracking === 'SERIAL' && <ChevronRight className="w-5 h-5 text-outline" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-20 flex gap-2 pt-2">
        <button
          onClick={async () => { if (await confirm({ title: 'Zrušit inventuru?', message: 'Napočítané hodnoty se zahodí, sklad zůstane beze změny.', confirmLabel: 'Zrušit inventuru', danger: true })) stock.cancelStocktake(open.id); }}
          className="h-14 px-4 rounded-2xl border border-outline-variant bg-card-bg text-on-surface-variant flex items-center gap-1.5"
          aria-label="Zrušit inventuru"
        >
          <X className="w-5 h-5" />
        </button>
        <button onClick={() => setShowResult(true)} className="flex-1 h-14 rounded-2xl bg-secondary text-on-secondary text-base font-bold shadow">
          Vyhodnotit ({counted}/{lines.length})
        </button>
      </div>

      {serialLine && <SerialLineSheet line={lines.find((l) => l.id === serialLine)} onClose={() => setSerialLine(null)} />}
      {showResult && <ResultSheet stocktake={open} lines={lines} onClose={() => setShowResult(false)} />}
    </div>
  );
};
