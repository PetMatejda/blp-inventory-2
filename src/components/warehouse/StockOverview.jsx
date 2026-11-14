import React, { useMemo, useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet, SheetAction, useDialogs } from '../common/Dialogs';
import { CodeInput, downloadText } from '../common/CodeInput';
import { ItemThumbnail } from '../common/ItemThumbnail';
import { CATEGORIES, getCategoryMeta } from '../../utils/categoryIcons';
import { levelOf, ownedCount, trackingOf, toCsv } from '../../domain/stock';
import { plural } from '../../domain/labels';
import { catalogLabelPayload, resolveCode } from '../../domain/labels-qr';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { LabelPrint } from './LabelPrint';
import { RestoreCatalogCard } from './RestoreCatalogCard';
import {
  Search, Download, PackagePlus, PackageMinus, Wrench, Undo2, Tag, Hash, Warehouse, ChevronRight, Printer, QrCode,
} from 'lucide-react';

const UNIT_STATUS = { IN_STOCK: 'Ve skladu', IN_SERVICE: 'V servisu', MISSING: 'Chybí', RETIRED: 'Vyřazen' };

const unitLabel = (unit, item) => ({ payload: unit.code, code: unit.code, title: item.name, subtitle: 'BLP' });
const itemLabel = (item) => ({ payload: catalogLabelPayload(item), code: item.serialPrefix || 'BLP', title: item.name, subtitle: getCategoryMeta(item.category).label });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

const StockItemSheet = ({ item, onClose }) => {
  const { stockLevels, stockUnits, movements, stock } = useInventory();
  const { askNumber, confirm, toast } = useDialogs();
  const [addingUnit, setAddingUnit] = useState(false);
  const [printLabels, setPrintLabels] = useState(null);
  const level = levelOf(stockLevels, item.id);
  const tracking = trackingOf(item);
  const units = stockUnits.filter((u) => u.catalogId === item.id);
  const unlabelled = Math.max(0, level.inStock - units.filter((u) => u.status === 'IN_STOCK').length);
  const printableUnits = units.filter((u) => u.status !== 'RETIRED');
  const history = movements.filter((m) => m.catalogId === item.id).slice(0, 15);

  const ask = async (title, max) => askNumber({ title: item.name, message: title, value: 1, max });
  const act = (label, fn, n) => { fn(item.id, n); toast({ text: `${label}: ${n} ks` }); };

  return (
    <Sheet title={item.name} subtitle={`${getCategoryMeta(item.category).label} · ${tracking === 'SERIAL' ? 'po kusech' : 'počtem'}`} onClose={onClose}>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[['Sklad', level.inStock], ['Zakázky', level.onJob], ['Servis', level.inService], ['Chybí', level.missing]].map(([l, v]) => (
          <div key={l} className={`rounded-xl border p-2 ${l === 'Chybí' && v ? 'border-error/40 bg-error-container/20' : 'border-outline-variant bg-surface-container'}`}>
            <div className="text-2xl font-bold text-on-surface">{v}</div>
            <div className="text-xs text-on-surface-variant">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {tracking === 'SERIAL' ? (
          <SheetAction icon={Tag} label="Přijmout kus se štítkem" hint="Naskenujte nebo zadejte kód nového kusu" onClick={() => setAddingUnit((a) => !a)} />
        ) : (
          <SheetAction icon={PackagePlus} label="Příjem na sklad" onClick={async () => { const n = await ask('Přijato kusů'); if (n) act('Přijato', stock.receive, n); }} />
        )}
        {addingUnit && (
          <div className="rounded-xl border border-outline-variant p-3 flex flex-col gap-2">
            <CodeInput placeholder="Kód / SN nového kusu" onCode={(code) => {
              const err = stock.addUnit(item.id, code);
              toast({ text: err || `Přijat kus ${code}` });
            }} />
          </div>
        )}
        {tracking === 'QUANTITY' && (
          <>
            <SheetAction icon={Wrench} label="Do servisu" disabled={!level.inStock} onClick={async () => { const n = await ask('Kusů do servisu', level.inStock); if (n) act('Do servisu', stock.toService, n); }} />
            <SheetAction icon={Undo2} label="Ze servisu zpět" disabled={!level.inService} onClick={async () => { const n = await ask('Kusů ze servisu', level.inService); if (n) act('Ze servisu', stock.fromService, n); }} />
            <SheetAction icon={PackageMinus} label="Vyřadit" danger disabled={!level.inStock} onClick={async () => {
              const n = await ask('Vyřadit kusů', level.inStock);
              if (n && await confirm({ title: `Vyřadit ${n} ks?`, message: `${item.name} – kusy zmizí ze skladu (poškozené, ztracené, prodané).`, confirmLabel: 'Vyřadit', danger: true })) act('Vyřazeno', stock.retire, n);
            }} />
          </>
        )}
        {tracking === 'SERIAL' ? (
          <>
            <SheetAction icon={QrCode} label="Vytvořit štítky pro kusy ve skladu" disabled={!unlabelled}
              hint={unlabelled ? `${unlabelled} ${plural(unlabelled, 'kus nemá', 'kusy nemají', 'kusů nemá')} štítek · počty se nemění` : 'Všechny kusy ve skladu mají štítek'}
              onClick={async () => {
                const n = await askNumber({ title: item.name, message: 'Kolik kusů označit štítkem', value: unlabelled, max: unlabelled });
                if (!n) return;
                const codes = stock.labelExistingUnits(item.id, n);
                if (codes.length) toast({ text: `Vytvořeno ${codes.length} štítků (${codes[0]} – ${codes[codes.length - 1]})` });
              }} />
            <SheetAction icon={Printer} label="Tisknout štítky kusů" disabled={!printableUnits.length}
              hint={`${printableUnits.length} štítků · arch A4 3 × 8`}
              onClick={() => setPrintLabels(printableUnits.map((u) => unitLabel(u, item)))} />
          </>
        ) : (
          <SheetAction icon={Printer} label="Tisknout štítek položky" hint="Na krabici nebo regál – sken přičte kus na zakázku"
            onClick={async () => {
              const n = await askNumber({ title: item.name, message: 'Počet štítků', value: 1, max: 24 });
              if (n) setPrintLabels(Array.from({ length: n }, () => itemLabel(item)));
            }} />
        )}
        <SheetAction icon={Hash} label={tracking === 'SERIAL' ? 'Sledovat jen počtem' : 'Sledovat po kusech (štítky)'}
          hint="Změna způsobu evidence této položky"
          onClick={() => stock.setTracking(item.id, tracking === 'SERIAL' ? 'QUANTITY' : 'SERIAL')} />
      </div>

      {tracking === 'SERIAL' && (
        <div>
          <h3 className="text-sm font-bold text-on-surface mb-1">Kusy se štítkem ({units.length})</h3>
          {units.length === 0 && <p className="text-sm text-on-surface-variant">Zatím žádný kus nemá štítek. Počty ve skladu se vedou i bez nich.</p>}
          <ul className="flex flex-col gap-1">
            {units.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 rounded-xl border border-outline-variant px-3 py-2">
                <span className="min-w-0">
                  <span className="font-mono text-sm text-on-surface">{u.code}</span>
                  {u.jobName && <span className="block text-xs text-on-surface-variant truncate">na zakázce {u.jobName}</span>}
                </span>
                <select
                  value={u.status}
                  onChange={async (e) => {
                    const next = e.target.value;
                    if (next === 'RETIRED' && !(await confirm({ title: `Vyřadit kus ${u.code}?`, confirmLabel: 'Vyřadit', danger: true }))) return;
                    stock.setUnitStatus(u.id, next);
                  }}
                  className="h-10 rounded-lg border border-outline-variant bg-card-bg text-sm px-2"
                  aria-label={`Stav kusu ${u.code}`}
                >
                  {Object.entries(UNIT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-on-surface mb-1">Poslední pohyby</h3>
        {history.length === 0 ? <p className="text-sm text-on-surface-variant">Žádné pohyby.</p> : (
          <ul className="text-sm divide-y divide-outline-variant/50">
            {history.map((m) => (
              <li key={m.id} className="py-1.5 flex justify-between gap-2">
                <span className="text-on-surface">{m.label}{m.jobName ? ` · ${m.jobName}` : ''}{m.unitCode ? ` · ${m.unitCode}` : ''}</span>
                <span className="text-on-surface-variant shrink-0">{m.qty > 0 && m.type === 'STOCKTAKE' ? '+' : ''}{m.qty} ks · {fmtDate(m.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {printLabels && <LabelPrint labels={printLabels} onDone={() => setPrintLabels(null)} />}
    </Sheet>
  );
};

export const StockOverview = () => {
  const { catalog, stockLevels, stockUnits, stock } = useInventory();
  const { confirm, toast } = useDialogs();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [selected, setSelected] = useState(null);
  const [bulkLabels, setBulkLabels] = useState(null);

  // Hardware barcode reader: scanning a label / EAN opens the item detail.
  useBarcodeScanner((code) => {
    const r = resolveCode(code, { jobItems: [], catalog, units: stockUnits });
    const item = r.kind === 'UNIT' ? catalog.find((c) => c.id === r.unit.catalogId) : r.kind === 'CATALOG' ? r.catalogItem : null;
    if (item) { setSelected(item); if (r.kind === 'UNIT') toast({ text: `Kus ${r.unit.code}` }); } else toast({ text: `✗ Neznámý kód ${code}` });
  }, { enabled: catalog.length > 0 && !selected });

  const rows = useMemo(() => catalog
    .filter((c) => !c.isBundle)
    .map((c) => ({ item: c, level: levelOf(stockLevels, c.id), tracking: trackingOf(c) })), [catalog, stockLevels]);

  const visible = rows.filter(({ item, level }) => {
    if (category !== 'ALL' && getCategoryMeta(item.category).id !== category) return false;
    if (onlyProblems && !(level.missing || level.inService)) return false;
    const q = query.trim().toLowerCase();
    return !q || item.name.toLowerCase().includes(q);
  });

  if (catalog.length === 0) return <RestoreCatalogCard />;

  if (stockLevels.length === 0) {
    return (
      <div className="bg-card-bg border border-outline-variant rounded-2xl p-6 text-center flex flex-col items-center gap-3">
        <Warehouse className="w-12 h-12 text-primary" />
        <p className="text-lg font-bold text-on-surface">Stav skladu ještě není založený</p>
        <p className="text-sm text-on-surface-variant max-w-sm">
          Výchozí počty se vezmou z katalogu („počet k dispozici“). Přesný stav pak srovná první inventura.
        </p>
        <button
          onClick={async () => {
            if (await confirm({ title: 'Založit stav skladu?', message: `${rows.length} položek katalogu dostane počet ve skladu podle „počet k dispozici“.`, confirmLabel: 'Založit' })) {
              const n = stock.initStockFromCatalog();
              toast({ text: `Založeno ${n} položek skladu` });
            }
          }}
          className="h-14 px-6 rounded-2xl bg-primary text-on-primary-container font-bold"
        >
          Založit stav podle katalogu
        </button>
      </div>
    );
  }

  const exportCsv = () => {
    const csv = toCsv(rows, [
      { label: 'Položka', value: (r) => r.item.name },
      { label: 'Kategorie', value: (r) => getCategoryMeta(r.item.category).label },
      { label: 'Evidence', value: (r) => (r.tracking === 'SERIAL' ? 'po kusech' : 'počtem') },
      { label: 'Ve skladu', value: (r) => r.level.inStock },
      { label: 'Na zakázkách', value: (r) => r.level.onJob },
      { label: 'V servisu', value: (r) => r.level.inService },
      { label: 'Chybí', value: (r) => r.level.missing },
      { label: 'Celkem (bez chybějících)', value: (r) => ownedCount(r.level) },
    ]);
    downloadText(`BLP_stav_skladu_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  // Bulk print: every labelled unit (not retired) of the visible items + one label per item tracked by count.
  const printVisible = async () => {
    const labels = visible.flatMap(({ item, tracking }) => (tracking === 'SERIAL'
      ? stockUnits.filter((u) => u.catalogId === item.id && u.status !== 'RETIRED').map((u) => unitLabel(u, item))
      : [itemLabel(item)]));
    if (!labels.length) { toast({ text: 'Žádné štítky k tisku' }); return; }
    const sheets = Math.ceil(labels.length / 24);
    if (await confirm({
      title: `Tisknout ${labels.length} štítků?`,
      message: `${sheets} ${plural(sheets, 'arch', 'archy', 'archů')} A4 (3 × 8 štítků 70 × 37 mm). Kusy bez štítku nejdřív označte v detailu položky.`,
      confirmLabel: 'Tisknout',
    })) setBulkLabels(labels);
  };

  const totals = rows.reduce((t, r) => ({ inStock: t.inStock + r.level.inStock, onJob: t.onJob + r.level.onJob, problems: t.problems + (r.level.missing || r.level.inService ? 1 : 0) }), { inStock: 0, onJob: 0, problems: 0 });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-outline-variant bg-card-bg p-3"><div className="text-2xl font-bold">{totals.inStock}</div><div className="text-xs text-on-surface-variant">ks ve skladu</div></div>
        <div className="rounded-xl border border-outline-variant bg-card-bg p-3"><div className="text-2xl font-bold">{totals.onJob}</div><div className="text-xs text-on-surface-variant">ks na zakázkách</div></div>
        <button onClick={() => setOnlyProblems((v) => !v)} className={`rounded-xl border p-3 ${onlyProblems ? 'border-error bg-error-container/30' : 'border-outline-variant bg-card-bg'}`}>
          <div className="text-2xl font-bold">{totals.problems}</div><div className="text-xs text-on-surface-variant">servis / chybí</div>
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat ve skladu…"
            className="w-full h-12 pl-10 pr-3 bg-card-bg border border-outline-variant rounded-xl text-base text-on-surface focus:border-primary focus:outline-none" />
        </div>
        <button onClick={exportCsv} className="h-12 px-3 rounded-xl border border-outline-variant bg-card-bg text-sm font-semibold flex items-center gap-1.5" aria-label="Export stavu skladu do CSV">
          <Download className="w-5 h-5" /> CSV
        </button>
        <button onClick={printVisible} className="h-12 px-3 rounded-xl border border-outline-variant bg-card-bg text-sm font-semibold flex items-center gap-1.5" aria-label="Tisk štítků zobrazených položek">
          <Printer className="w-5 h-5" /> Štítky
        </button>
      </div>
      {bulkLabels && <LabelPrint labels={bulkLabels} onDone={() => setBulkLabels(null)} />}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {[{ id: 'ALL', label: 'Vše' }, ...CATEGORIES].map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            className={`h-10 px-3 rounded-xl text-sm font-semibold whitespace-nowrap border shrink-0 ${category === c.id ? 'bg-primary text-on-primary-container border-primary' : 'bg-card-bg border-outline-variant text-on-surface-variant'}`}>
            {c.label}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map(({ item, level, tracking }) => (
          <li key={item.id}>
            <button onClick={() => setSelected(item)} className="w-full text-left bg-card-bg border border-outline-variant rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99]">
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0"><ItemThumbnail src={item.image} name={item.name} category={item.category} className="w-full h-full" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-on-surface leading-snug truncate">{item.name}</p>
                <p className="text-sm text-on-surface-variant">
                  {tracking === 'SERIAL' ? 'po kusech · ' : ''}na zakázkách {level.onJob}
                  {level.inService ? ` · servis ${level.inService}` : ''}
                  {level.missing ? <span className="text-error font-semibold"> · chybí {level.missing}</span> : null}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold font-mono text-on-surface">{level.inStock}</div>
                <div className="text-xs text-on-surface-variant">{plural(level.inStock, 'kus', 'kusy', 'kusů')} sklad</div>
              </div>
              <ChevronRight className="w-5 h-5 text-outline shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      {selected && <StockItemSheet item={catalog.find((c) => c.id === selected.id) || selected} onClose={() => setSelected(null)} />}
    </div>
  );
};
