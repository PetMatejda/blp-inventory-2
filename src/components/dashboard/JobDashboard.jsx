import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useLongPress } from '../../hooks/useLongPress';
import { Plus, FolderOpen, Calendar, User, FileText, AlertTriangle, CheckCircle, Lock, Unlock, Copy, Edit2, Archive, MoreVertical, Package, Truck } from 'lucide-react';

const JobCardItem = ({ job, isSelected }) => {
  const { allJobItems, setCurrentJobId, setActiveTab, setEditingJob, setTemplateJob, setIsProtocolModalOpen, finishJob, reactivateJob, setContextMenu, isAdmin } = useInventory();

  // Use allJobItems so dashboard always shows correct counts regardless of active job
  const items = allJobItems.filter(i => i.jobId === job.id);
  const totalReq = items.reduce((sum, i) => sum + (i.quantityRequested || 1), 0);
  const totalRows = items.length;
  const loadedCount = items.filter(i => i.status === 'LOADED').reduce((sum, i) => sum + (i.quantityLoaded || 0), 0);
  const packedCount = items.filter(i => i.status === 'PACKED').reduce((sum, i) => sum + (i.quantityLoaded || 0), 0);
  const loadedRows = items.filter(i => i.status === 'LOADED').length;
  const packedRows = items.filter(i => i.status === 'PACKED').length;
  const damagedCount = items.filter(i => i.status === 'DAMAGED').length;
  const isArchived = job.status === 'ARCHIVED';
  const isModeDerigging = job.mode === 'DERIGGING';

  // Mode aware progress calculation
  const currentDoneCount = isModeDerigging ? packedCount : loadedCount;
  const currentDoneRows = isModeDerigging ? packedRows : loadedRows;
  const progress = totalReq > 0 ? Math.round((currentDoneCount / totalReq) * 100) : (totalRows > 0 ? Math.round((currentDoneRows / totalRows) * 100) : 0);


  // Attach tap & long press
  const longPressProps = useLongPress(
    (e) => {
      e.stopPropagation();
      setContextMenu({ type: 'JOB', target: job });
    },
    () => {
      setCurrentJobId(job.id);
      setActiveTab('packing');
    }
  );

  return (
    <article
      {...longPressProps}
      className={`bg-card-bg rounded-2xl border transition-all overflow-hidden flex flex-col shadow-md relative cursor-pointer select-none ${
        isSelected ? 'border-primary ring-1 ring-primary/40' : 'border-outline-variant hover:border-outline'
      }`}
    >
      <div className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-xl font-bold text-on-surface">{job.name}</h2>
              {isArchived && (
                <span className="px-2 py-0.5 bg-surface-container-highest text-outline font-mono text-[11px] font-bold rounded border border-outline-variant flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Ukončeno
                </span>
              )}
              {!isArchived && isModeDerigging && (
                <span className="px-2.5 py-0.5 bg-blue-500/15 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-mono text-[11px] font-bold rounded border border-blue-500/40 flex items-center gap-1">
                  <Truck className="w-3 h-3" /> REŽIM DERIGGING
                </span>
              )}
              {!isArchived && !isModeDerigging && (
                <span className="px-2.5 py-0.5 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[11px] font-bold rounded border border-emerald-500/40 flex items-center gap-1">
                  <Package className="w-3 h-3" /> REŽIM RIGGING
                </span>
              )}
            </div>
            <p className="text-xs text-primary font-medium">{job.client}</p>

            {/* Info badges: BLP Responsible, Gaffer & Rigging/Derigging Dates */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-on-surface-variant">
              <span className="flex items-center gap-1.5 font-semibold text-primary">
                <User className="w-3.5 h-3.5" /> BLP: {job.blpResponsible || 'Marek Radolf'}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-outline" /> Gaffer: {job.assignedGaffer || 'Nezadáno'}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-secondary" /> Rigging: {job.riggingDate || job.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-tertiary" /> Derigging: {job.deriggingDate || job.date}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`px-3 py-1 text-xs font-mono font-bold rounded-full border ${
                job.status === 'ACTIVE'
                  ? 'bg-secondary-container text-on-secondary-container border-secondary/40'
                  : 'bg-surface-variant text-outline border-outline-variant'
              }`}
            >
              {job.status === 'ACTIVE' ? 'Aktivní' : 'Archivováno'}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu({ type: 'JOB', target: job });
              }}
              className="p-1.5 text-outline hover:text-on-surface bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg transition-colors"
              title="Otevřít kontextové menu zakázky"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Aware Progress Section */}
        <div className="flex flex-col gap-1.5 mt-2 bg-surface-container p-3 rounded-xl border border-outline-variant">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className={`font-bold flex items-center gap-1.5 ${isModeDerigging ? 'text-cyan-400' : 'text-emerald-400'}`}>
              {isModeDerigging ? <Truck className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
              {isModeDerigging ? 'PRŮBĚH DERIGGINGU (SBALENO K ODVOZU)' : 'PRŮBĚH NAKLÁDKY (NA PLACE)'}
            </span>
            <span className="text-on-surface font-bold">
              {currentDoneCount} / {totalReq} ks ({currentDoneRows} / {totalRows} položek) • {progress} %
            </span>
          </div>

          {/* High-Contrast Progress Bar */}
          <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden border border-outline-variant p-0.5">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isModeDerigging ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50' : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {damagedCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-error font-semibold mt-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Poškozeno: {damagedCount} ks techniky
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="p-3 border-t border-outline-variant bg-surface-container flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTemplateJob(job);
            }}
            className="h-10 px-3.5 rounded-xl border border-outline-variant bg-card-bg hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
          >
            <Copy className="w-4 h-4 text-secondary" />
            <span>Použít jako vzor</span>
          </button>
        </div>

        <div className="flex gap-2">
          {isArchived ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                reactivateJob(job.id);
              }}
              className="h-10 px-4 rounded-xl border border-outline-variant bg-card-bg hover:bg-surface-container-high text-primary font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Unlock className="w-4 h-4 text-secondary" />
              <span>Obnovit</span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Chcete dokončit zakázku "${job.name}" a přesunout ji do archivu?`)) {
                  finishJob(job.id);
                }
              }}
              className="h-10 px-3.5 rounded-xl border border-outline-variant bg-card-bg hover:border-error/40 hover:bg-error-container/20 text-on-surface hover:text-error font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Lock className="w-4 h-4" />
              <span>Ukončit</span>
            </button>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentJobId(job.id);
            setActiveTab('packing');
          }}
          className="h-10 px-5 rounded-xl bg-secondary text-on-secondary-container hover:opacity-90 text-sm font-semibold flex items-center gap-2 justify-center transition-all active:scale-95 shadow"
        >
          <FolderOpen className="w-4 h-4" />
          {isArchived ? 'Zobrazit' : 'Otevřít Packaging'}
        </button>
      </div>
    </article>
  );
};




export const JobDashboard = () => {
  const { jobs, currentJobId, setIsNewJobModalOpen, isAdmin } = useInventory();
  const [filterState, setFilterState] = useState('ACTIVE');

  const filteredJobs = jobs.filter(j => j.status === filterState);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-4 pb-24">
      {/* Active vs Archived Toggle + New Job CTA */}
      <div className="flex items-center gap-2">
        <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant shadow-sm flex-1">
          <button
            onClick={() => setFilterState('ACTIVE')}
            className={`flex-1 py-2 text-center rounded-lg font-semibold text-sm transition-all ${
              filterState === 'ACTIVE'
                ? 'bg-primary-container text-on-primary-container shadow-sm border border-primary/30'
                : 'text-outline hover:text-on-surface'
            }`}
          >
            Aktivní ({jobs.filter(j => j.status === 'ACTIVE').length})
          </button>
          <button
            onClick={() => setFilterState('ARCHIVED')}
            className={`flex-1 py-2 text-center rounded-lg font-semibold text-sm transition-all ${
              filterState === 'ARCHIVED'
                ? 'bg-primary-container text-on-primary-container shadow-sm border border-primary/30'
                : 'text-outline hover:text-on-surface'
            }`}
          >
            Archiv ({jobs.filter(j => j.status === 'ARCHIVED').length})
          </button>
        </div>

        <button
          onClick={() => setIsNewJobModalOpen(true)}
          className="h-10 w-10 bg-primary text-on-primary-container font-semibold rounded-xl hover:bg-opacity-90 transition-all flex items-center justify-center shadow-md active:scale-95 shrink-0"
          title="Nová Zakázka"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Jobs List */}
      <div className="flex flex-col gap-4">
        {filteredJobs.length === 0 ? (
          <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-outline flex flex-col items-center gap-3">
            <FolderOpen className="w-12 h-12 text-outline/50" />
            <p>Žádné zakázky v této záložce.</p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <JobCardItem
              key={job.id}
              job={job}
              isSelected={job.id === currentJobId}
            />
          ))
        )}
      </div>
    </div>
  );
};
