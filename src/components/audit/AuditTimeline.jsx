import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { History, CheckCircle2, AlertTriangle, Briefcase, Plus, Filter, User, FolderOpen } from 'lucide-react';

export const AuditTimeline = () => {
  const { auditLogs, jobs } = useInventory();
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedJobIdFilter, setSelectedJobIdFilter] = useState('ALL');

  const filteredLogs = auditLogs.filter((log) => {
    if (typeFilter !== 'ALL' && log.type !== typeFilter) return false;
    if (selectedJobIdFilter !== 'ALL' && log.jobId !== selectedJobIdFilter) return false;
    return true;
  });

  const getDotStyle = (type) => {
    switch (type) {
      case 'loaded':
        return { bg: 'bg-secondary', text: 'text-on-secondary-container', icon: CheckCircle2 };
      case 'damage':
        return { bg: 'bg-error', text: 'text-on-error-container', icon: AlertTriangle };
      case 'bracha':
        return { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', icon: Briefcase };
      case 'add':
        return { bg: 'bg-primary-container', text: 'text-on-primary-container', icon: Plus };
      default:
        return { bg: 'bg-surface-variant', text: 'text-on-surface-variant', icon: History };
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6 pb-28">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Auditní Log (Timeline)
          </h1>
          <p className="text-sm text-outline">Nezměnitelná historie všech provedených změn a operací na zakázkách</p>
        </div>
      </div>

      {/* Job Filter Dropdown & Event Type Chips */}
      <div className="bg-card-bg rounded-2xl border border-outline-variant p-4 flex flex-col gap-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-1.5 shrink-0">
            <FolderOpen className="w-4 h-4 text-secondary" /> Filtrovat podle zakázky:
          </label>
          <select
            value={selectedJobIdFilter}
            onChange={(e) => setSelectedJobIdFilter(e.target.value)}
            className="h-10 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm font-bold text-on-surface focus:outline-none focus:border-primary truncate cursor-pointer"
          >
            <option value="ALL">Všechny zakázky (Globální log)</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.name} ({job.client})
              </option>
            ))}
          </select>
        </div>

        {/* Filter Event Type Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 border-t border-outline-variant/60">
          <span className="text-xs font-mono text-outline uppercase flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Typ události:
          </span>
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              typeFilter === 'ALL'
                ? 'bg-primary text-on-primary-container border-primary'
                : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            Všechny typy ({auditLogs.length})
          </button>
          <button
            onClick={() => setTypeFilter('loaded')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              typeFilter === 'loaded'
                ? 'bg-secondary text-on-secondary-container border-secondary'
                : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            Rigging / Změny stavu
          </button>
          <button
            onClick={() => setTypeFilter('add')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              typeFilter === 'add'
                ? 'bg-primary-container text-on-primary-container border-primary'
                : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            Přidání techniky
          </button>
          <button
            onClick={() => setTypeFilter('damage')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              typeFilter === 'damage'
                ? 'bg-error-container text-on-error-container border-error'
                : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            Závady
          </button>
          <button
            onClick={() => setTypeFilter('bracha')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              typeFilter === 'bracha'
                ? 'bg-tertiary-container text-on-tertiary-container border-tertiary'
                : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            Brácha
          </button>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/40">
        {filteredLogs.length === 0 ? (
          <div className="bg-card-bg border border-outline-variant rounded-2xl p-8 text-center text-outline">
            Žádné auditní záznamy neodpovídají zvolenému filtru.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const dot = getDotStyle(log.type);
            const Icon = dot.icon;
            const formattedDate = new Date(log.timestamp).toLocaleTimeString('cs-CZ', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const formattedFullDate = new Date(log.timestamp).toLocaleDateString('cs-CZ', {
              day: 'numeric',
              month: 'numeric',
            });

            const associatedJob = jobs.find(j => j.id === log.jobId);

            return (
              <div key={log.id} className="relative group">
                {/* Dot Icon */}
                <div
                  className={`absolute -left-6 top-1 -translate-x-1/2 w-7 h-7 rounded-full ${dot.bg} ${dot.text} border-2 border-background flex items-center justify-center shadow z-10`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {/* Log Card */}
                <div className="bg-card-bg rounded-2xl p-4 border border-outline-variant shadow-sm hover:border-outline transition-all">
                  <div className="flex justify-between items-start mb-1.5 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-outline">{formattedFullDate} {formattedDate}</span>
                      {associatedJob && (
                        <span className="bg-primary-container/40 text-on-primary-container border border-primary/30 px-2 py-0.5 rounded font-mono text-[10px] font-bold flex items-center gap-1">
                          <FolderOpen className="w-3 h-3 text-primary" /> {associatedJob.name}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-surface-container-highest text-on-surface uppercase shrink-0">
                      {log.action}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-on-surface mb-2.5">{log.detail}</p>

                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/50 text-xs text-on-surface-variant">
                    <div className="w-5 h-5 rounded-full bg-surface-variant flex items-center justify-center overflow-hidden border border-outline-variant">
                      <User className="w-3 h-3 text-outline" />
                    </div>
                    <span className="font-semibold text-on-surface">{log.user}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
