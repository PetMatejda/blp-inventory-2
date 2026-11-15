import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet, useDialogs } from '../common/Dialogs';
import { phaseOf, phaseSummary, plural } from '../../domain/labels';
import { restockPlan } from '../../domain/stock';
import { missingUnitIds } from '../../domain/labels-qr';
import { AlertTriangle, CheckCircle2, FileText, Lock, Warehouse } from 'lucide-react';

const Stat = ({ value, label, tone }) => (
  <div className={`rounded-xl border p-3 text-center ${
    tone === 'warn' ? 'bg-tertiary-container/30 border-tertiary/40' : tone === 'bad' ? 'bg-error-container/30 border-error/40' : 'bg-surface-container border-outline-variant'
  }`}>
    <div className="text-2xl font-bold text-on-surface">{value}</div>
    <div className="text-xs text-on-surface-variant">{label}</div>
  </div>
);

/**
 * Guided job closing.
 *  - Restock phase: shows what goes back to stock / to service / is missing, then archives.
 *  - Earlier phases: summary of what is missing or damaged → protocol → archive (with undo).
 *    If the equipment was issued from the warehouse, restocking is recommended first.
 */
export const FinishJobSheet = () => {
  const {
    finishingJob: job, setFinishingJob, allJobItems, finishJob, reactivateJob, catalog, stockUnits,
    setCurrentJobId, setIsProtocolModalOpen, setActiveTab, finishRestock, changeJobPhase,
  } = useInventory();
  const { toast, confirm } = useDialogs();
  if (!job) return null;

  const items = allJobItems.filter((i) => i.jobId === job.id);
  const phase = phaseOf(job.mode);
  const s = phaseSummary(items, job.mode);
  const close = () => setFinishingJob(null);
  const nameOf = (id) => catalog.find((c) => c.id === id)?.name || items.find((i) => i.catalogId === id)?.name || id;
  const protocolButton = (
    <button
      onClick={() => { setCurrentJobId(job.id); setIsProtocolModalOpen(true); }}
      className="h-14 rounded-2xl border border-outline-variant bg-surface-container text-on-surface text-base font-semibold flex items-center justify-center gap-2"
    >
      <FileText className="w-5 h-5 text-primary" /> Předávací protokol (PDF)
    </button>
  );

  // ── Restock: show the stock movements before they happen ──
  if (job.mode === 'RESTOCK') {
    const plan = restockPlan(items, job.issued || {});
    const rows = Object.entries(plan);
    const totals = rows.reduce((t, [, r]) => ({
      returned: t.returned + r.returned, toService: t.toService + r.toService, missing: t.missing + r.missing,
    }), { returned: 0, toService: 0, missing: 0 });
    const problems = rows.filter(([, r]) => r.missing || r.toService);
    const missingCodes = items.flatMap(missingUnitIds)
      .map((id) => stockUnits.find((u) => u.id === id)?.code).filter(Boolean);

    const finish = async () => {
      if (totals.missing && !(await confirm({
        title: `Chybí ${totals.missing} ks`,
        message: 'Chybějící kusy se zapíšou jako „chybí po zakázce“ a nebudou se počítat do dostupné techniky, dokud se nenajdou (inventura).',
        confirmLabel: 'Dokončit i tak',
        danger: true,
      }))) return;
      finishRestock(job.id);
      close();
      setActiveTab('dashboard');
      toast({ text: `${job.name}: naskladněno, zakázka v archivu` });
    };

    return (
      <Sheet title={`Dokončit naskladnění „${job.name}“`} subtitle={job.issued ? 'Sklad se upraví podle napočítaných kusů' : 'Zakázka byla založena před evidencí skladu'} onClose={close}>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={totals.returned} label="Do skladu" />
          <Stat value={totals.toService} label="Do servisu" tone={totals.toService ? 'warn' : ''} />
          <Stat value={job.issued ? totals.missing : '—'} label="Chybí" tone={totals.missing ? 'bad' : ''} />
        </div>
        {problems.length > 0 && (
          <ul className="rounded-xl border border-outline-variant bg-surface-container p-3 text-sm text-on-surface-variant flex flex-col gap-1">
            {problems.slice(0, 8).map(([id, r]) => (
              <li key={id}>
                <strong className="text-on-surface">{nameOf(id)}</strong>
                {r.missing ? ` – chybí ${r.missing} ks` : ''}{r.toService ? ` – do servisu ${r.toService} ks` : ''}
              </li>
            ))}
            {problems.length > 8 && <li>… a další</li>}
          </ul>
        )}
        {missingCodes.length > 0 && (
          <p className="text-sm rounded-xl border border-error/40 bg-error-container/20 p-3 text-on-surface">
            Nenaskenované kusy se štítkem: <strong className="font-mono">{missingCodes.join(', ')}</strong>
          </p>
        )}
        {!job.issued && <p className="text-sm text-on-surface-variant">Tato zakázka se nevydávala ze skladu, proto se upraví jen kusy se závadou (přesun do servisu).</p>}
        <div className="flex flex-col gap-2">
          {protocolButton}
          <button onClick={finish} className="h-14 rounded-2xl bg-secondary text-on-secondary text-base font-bold shadow flex items-center justify-center gap-2">
            <Lock className="w-5 h-5" /> Dokončit naskladnění a archivovat
          </button>
        </div>
      </Sheet>
    );
  }

  // ── Rigging / derigging ──
  const archive = () => {
    finishJob(job.id);
    close();
    setActiveTab('dashboard');
    toast({
      text: `${job.name} je v archivu`,
      actionLabel: 'Vrátit',
      onAction: () => { reactivateJob(job.id); setCurrentJobId(job.id); setActiveTab('packing'); },
    });
  };
  const startRestock = () => {
    changeJobPhase('RESTOCK', job.id);
    setCurrentJobId(job.id);
    close();
    setActiveTab('packing');
  };
  const issuedPieces = Object.values(job.issued || {}).reduce((a, b) => a + b, 0);

  return (
    <Sheet title={`Ukončit „${job.name}“`} subtitle={`Fáze: ${phase.name}`} onClose={close}>
      <div className="grid grid-cols-3 gap-2">
        <Stat value={`${s.donePieces}/${s.totalPieces}`} label={`${phase.progressLabel} (ks)`} />
        <Stat value={s.remaining.length} label={phase.remainingLabel} tone={s.remaining.length ? 'warn' : ''} />
        <Stat value={s.damaged.length} label="Závady" tone={s.damaged.length ? 'bad' : ''} />
      </div>

      {s.remaining.length === 0 && s.damaged.length === 0 ? (
        <p className="flex items-center gap-2 text-base text-secondary font-semibold"><CheckCircle2 className="w-5 h-5" /> {phase.allDone}, nic nechybí.</p>
      ) : (
        <div className="rounded-xl border border-tertiary/40 bg-tertiary-container/20 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-on-surface mb-1"><AlertTriangle className="w-4 h-4 text-tertiary" /> Zkontrolujte před uzavřením:</p>
          <ul className="list-disc pl-5 text-on-surface-variant">
            {[...s.damaged, ...s.remaining].slice(0, 6).map((i) => (
              <li key={i.id}>{i.name} – {i.status === 'DAMAGED' ? 'závada' : `${i.quantityLoaded}/${i.quantityRequested} ks`}</li>
            ))}
            {s.damaged.length + s.remaining.length > 6 && <li>… a další</li>}
          </ul>
        </div>
      )}

      {job.issued && (
        <p className="text-sm rounded-xl border border-violet-500/40 bg-violet-500/10 p-3 text-on-surface">
          Ze skladu je vydáno {issuedPieces} {plural(issuedPieces, 'kus', 'kusy', 'kusů')}. Doporučeno nejdřív <strong>naskladnit</strong> — jinak zůstanou vedené „na zakázce“.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {job.mode === 'DERIGGING' && job.status === 'ACTIVE' && (
          <button onClick={startRestock} className="h-14 rounded-2xl bg-violet-600 text-white text-base font-bold shadow flex items-center justify-center gap-2">
            <Warehouse className="w-5 h-5" /> Zahájit naskladnění
          </button>
        )}
        {protocolButton}
        <button onClick={archive} className={`h-14 rounded-2xl text-base font-bold shadow flex items-center justify-center gap-2 ${
          job.issued ? 'border border-outline-variant bg-surface-container text-on-surface' : 'bg-secondary text-on-secondary'
        }`}>
          <Lock className="w-5 h-5" /> {job.issued ? 'Archivovat bez naskladnění' : 'Ukončit a archivovat'}
        </button>
      </div>
    </Sheet>
  );
};
