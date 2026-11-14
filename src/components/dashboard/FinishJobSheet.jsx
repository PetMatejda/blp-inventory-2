import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet, useDialogs } from '../common/Dialogs';
import { phaseOf, phaseSummary } from '../../domain/labels';
import { AlertTriangle, CheckCircle2, FileText, Lock } from 'lucide-react';

/** Guided job closing: what is missing or damaged → protocol → archive (with undo). */
export const FinishJobSheet = () => {
  const {
    finishingJob: job, setFinishingJob, allJobItems, finishJob, reactivateJob,
    setCurrentJobId, setIsProtocolModalOpen, setActiveTab,
  } = useInventory();
  const { toast } = useDialogs();
  if (!job) return null;

  const items = allJobItems.filter((i) => i.jobId === job.id);
  const phase = phaseOf(job.mode);
  const s = phaseSummary(items, job.mode);
  const close = () => setFinishingJob(null);

  // After closing a job go back to the job list (instead of silently showing
  // another job); "Vrátit" restores the job and brings the user back to it.
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

  return (
    <Sheet title={`Ukončit „${job.name}“`} subtitle={`Fáze: ${phase.name}`} onClose={close}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-container border border-outline-variant p-3">
          <div className="text-2xl font-bold text-on-surface">{s.done}/{s.total}</div>
          <div className="text-xs text-on-surface-variant">{phase.progressLabel}</div>
        </div>
        <div className={`rounded-xl border p-3 ${s.remaining.length ? 'bg-tertiary-container/30 border-tertiary/40' : 'bg-surface-container border-outline-variant'}`}>
          <div className="text-2xl font-bold text-on-surface">{s.remaining.length}</div>
          <div className="text-xs text-on-surface-variant">{phase.remainingLabel}</div>
        </div>
        <div className={`rounded-xl border p-3 ${s.damaged.length ? 'bg-error-container/30 border-error/40' : 'bg-surface-container border-outline-variant'}`}>
          <div className="text-2xl font-bold text-on-surface">{s.damaged.length}</div>
          <div className="text-xs text-on-surface-variant">Závady</div>
        </div>
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

      <div className="flex flex-col gap-2">
        <button
          onClick={() => { setCurrentJobId(job.id); setIsProtocolModalOpen(true); }}
          className="h-14 rounded-2xl border border-outline-variant bg-surface-container text-on-surface text-base font-semibold flex items-center justify-center gap-2"
        >
          <FileText className="w-5 h-5 text-primary" /> Předávací protokol (PDF)
        </button>
        <button onClick={archive} className="h-14 rounded-2xl bg-secondary text-on-secondary-container text-base font-bold shadow flex items-center justify-center gap-2">
          <Lock className="w-5 h-5" /> Ukončit a archivovat
        </button>
      </div>
    </Sheet>
  );
};
