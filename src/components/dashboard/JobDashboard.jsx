import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useLongPress } from '../../hooks/useLongPress';
import { phaseOf, phaseSummary } from '../../domain/labels';
import { Plus, FolderOpen, Calendar, User, AlertTriangle, Lock, MoreVertical, Package, Truck, ChevronRight } from 'lucide-react';

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
};

const JobCardItem = ({ job, isSelected }) => {
  const { allJobItems, setCurrentJobId, setActiveTab, setContextMenu } = useInventory();

  const items = allJobItems.filter((i) => i.jobId === job.id);
  const isArchived = job.status === 'ARCHIVED';
  const isDerigging = job.mode === 'DERIGGING';
  const phase = phaseOf(job.mode);
  const s = phaseSummary(items, job.mode);
  const progress = s.total ? Math.round((s.done / s.total) * 100) : 0;

  const open = () => { setCurrentJobId(job.id); setActiveTab('packing'); };
  const openMenu = () => setContextMenu({ type: 'JOB', target: job });
  const { cancelLongPress, ...longPress } = useLongPress((e) => { e.stopPropagation(); openMenu(); }, open);

  return (
    <article className={`bg-card-bg rounded-2xl border overflow-hidden shadow-md relative select-none ${
      isSelected ? 'border-primary ring-1 ring-primary/40' : 'border-outline-variant'
    }`}>
      <div
        {...longPress}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
        aria-label={`Otevřít zakázku ${job.name}`}
        className="p-4 flex flex-col gap-3 cursor-pointer active:bg-surface-container/40"
      >
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-on-surface leading-snug break-words">{job.name}</h2>
            {job.client && <p className="text-sm text-primary font-medium">{job.client}</p>}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); openMenu(); }}
            className="w-11 h-11 -mr-1 -mt-1 shrink-0 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
            aria-label={`Možnosti zakázky ${job.name}`}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-variant">
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {formatDate(job.riggingDate || job.date)} – {formatDate(job.deriggingDate || job.date)}</span>
          {job.assignedGaffer && <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {job.assignedGaffer}</span>}
          {job.blpResponsible && <span className="flex items-center gap-1.5"><User className="w-4 h-4 text-primary" /> BLP: {job.blpResponsible}</span>}
        </div>

        <div className="flex flex-col gap-1.5 bg-surface-container p-3 rounded-xl border border-outline-variant">
          <div className="flex justify-between items-center text-sm">
            <span className={`font-bold flex items-center gap-1.5 ${
              isArchived ? 'text-on-surface-variant' : isDerigging ? 'text-cyan-700 dark:text-cyan-300' : 'text-emerald-700 dark:text-emerald-300'
            }`}>
              {isArchived ? <Lock className="w-4 h-4" /> : isDerigging ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              {isArchived ? 'Archiv' : `${phase.name} · ${phase.progressLabel.toLowerCase()}`}
            </span>
            <span className="font-mono font-bold text-on-surface">{s.done}/{s.total}</span>
          </div>
          <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden border border-outline-variant">
            <div className={`h-full rounded-full transition-all duration-300 ${isDerigging ? 'bg-cyan-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }} />
          </div>
          {s.damaged.length > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-error font-semibold mt-0.5">
              <AlertTriangle className="w-4 h-4" /> Závady: {s.damaged.length}
            </div>
          )}
        </div>

        <span className="self-end text-sm font-semibold text-secondary flex items-center gap-1">
          {isArchived ? 'Zobrazit' : 'Otevřít balení'} <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </article>
  );
};

export const JobDashboard = () => {
  const { jobs, currentJobId, setIsNewJobModalOpen } = useInventory();
  const [filterState, setFilterState] = useState('ACTIVE');

  const filteredJobs = jobs.filter((j) => j.status === filterState);
  const tab = (id, label) => (
    <button
      role="tab"
      aria-selected={filterState === id}
      onClick={() => setFilterState(id)}
      className={`flex-1 h-11 text-center rounded-lg font-semibold text-base transition-all ${
        filterState === id ? 'bg-primary-container text-on-primary-container shadow-sm border border-primary/30' : 'text-on-surface-variant'
      }`}
    >
      {label} ({jobs.filter((j) => j.status === id).length})
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-4 pb-24">
      <div className="flex items-center gap-2">
        <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant shadow-sm flex-1" role="tablist">
          {tab('ACTIVE', 'Aktivní')}
          {tab('ARCHIVED', 'Archiv')}
        </div>
        <button
          onClick={() => setIsNewJobModalOpen(true)}
          className="h-[52px] px-4 bg-primary text-on-primary-container font-semibold rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
          aria-label="Nová zakázka"
        >
          <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Nová</span>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {filteredJobs.length === 0 ? (
          <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant flex flex-col items-center gap-3">
            <FolderOpen className="w-12 h-12 text-outline/50" />
            <p className="text-base">{filterState === 'ACTIVE' ? 'Žádné aktivní zakázky.' : 'Archiv je prázdný.'}</p>
            {filterState === 'ACTIVE' && (
              <button onClick={() => setIsNewJobModalOpen(true)} className="h-12 px-5 rounded-xl bg-primary text-on-primary-container font-semibold">
                Založit zakázku
              </button>
            )}
          </div>
        ) : (
          filteredJobs.map((job) => <JobCardItem key={job.id} job={job} isSelected={job.id === currentJobId} />)
        )}
      </div>
    </div>
  );
};
