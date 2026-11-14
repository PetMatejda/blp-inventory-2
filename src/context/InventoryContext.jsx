import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { firebaseAuth } from '../services/firebaseAuth';
import { createFirestoreRepo } from '../services/inventoryRepo';
import { createInventoryActions } from '../services/inventoryActions';
import { migrateLegacyStore, MIGRATION_DOC } from '../services/migration';
import { db, doc, getDoc, runTransaction, writeBatch } from '../services/firebase';
import { INITIAL_VEHICLES } from '../mockData/initialData';
import { CATEGORIES } from '../utils/categoryIcons';

const InventoryContext = createContext();

const CURRENT_JOB_KEY = 'blp_current_job_id_v2';
const EMPTY_DATA = { jobs: [], jobItems: [], catalog: [], consumables: [], auditLogs: [] };

// Stable, readable order (Firestore returns documents by ID).
const categoryRank = (cat) => {
  const idx = (CATEGORIES || []).findIndex((c) => (c.id || c) === cat);
  return idx === -1 ? 999 : idx;
};
const byCategoryThenName = (a, b) =>
  categoryRank(a.category) - categoryRank(b.category) || String(a.name || '').localeCompare(String(b.name || ''), 'cs');
const SORTERS = {
  jobs: (a, b) => String(b.riggingDate || '').localeCompare(String(a.riggingDate || '')) || String(a.name || '').localeCompare(String(b.name || ''), 'cs'),
  jobItems: byCategoryThenName,
  catalog: byCategoryThenName,
  consumables: byCategoryThenName,
  auditLogs: (a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')),
};

const isPermissionError = (err) => /permission|insufficient/i.test(err?.code || err?.message || '');

export const InventoryProvider = ({ children }) => {
  const [data, setData] = useState(EMPTY_DATA);
  const [pending, setPending] = useState({});
  const [currentJobId, setCurrentJobIdState] = useState(() => {
    try { return localStorage.getItem(CURRENT_JOB_KEY) || ''; } catch { return ''; }
  });
  const [currentUser, setCurrentUserState] = useState(() => {
    try {
      const saved = localStorage.getItem('blp_auth_user_v2');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(() => {
    try { return !localStorage.getItem('blp_auth_user_v2'); } catch { return true; }
  });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [accessDenied, setAccessDenied] = useState(false);
  const [migrationState, setMigrationState] = useState(null); // null | 'running' | 'done'
  const [themeMode, setThemeMode] = useState('light');
  const [syncNotice, setSyncNotice] = useState(null);

  // Filters & Nav state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [damageReportItem, setDamageReportItem] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [templateJob, setTemplateJob] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const noticeTimer = useRef(null);
  const showNotice = useCallback((text, ms = 4000) => {
    clearTimeout(noticeTimer.current);
    setSyncNotice(text);
    if (ms) noticeTimer.current = setTimeout(() => setSyncNotice(null), ms);
  }, []);

  const denyAccess = useCallback(() => {
    setAccessDenied(true);
    showNotice('🔒 Tento účet nemá přístup k datům BLP. Požádejte správce o přidání vašeho e-mailu.', 0);
  }, [showNotice]);

  // ── Data layer ─────────────────────────────────────────────
  const dataRef = useRef(EMPTY_DATA);
  dataRef.current = data;
  const actorRef = useRef('Neznámý uživatel');
  actorRef.current = currentUser?.name ? `${currentUser.name} (${currentUser.role || 'USER'})` : 'Neznámý uživatel';

  const repo = useMemo(() => createFirestoreRepo({
    onWriteError: (err) => {
      if (isPermissionError(err)) denyAccess();
      else showNotice('⚠️ Změnu se nepodařilo uložit do cloudu. Zkuste to prosím znovu.');
    },
  }), [denyAccess, showNotice]);

  const actions = useMemo(() => createInventoryActions({
    repo,
    getState: () => dataRef.current,
    getActor: () => actorRef.current,
  }), [repo]);

  useEffect(() => {
    let unsubscribeData = () => {};
    let unsubscribeMarker = () => {};

    const startData = (user) => {
      unsubscribeData();
      unsubscribeMarker();
      setAccessDenied(false);

      unsubscribeData = repo.subscribe(
        (col, records, meta) => {
          setData((prev) => ({ ...prev, [col]: [...records].sort(SORTERS[col]) }));
          setPending((prev) => (prev[col] === meta.pending ? prev : { ...prev, [col]: meta.pending }));
        },
        (col, err) => {
          console.warn(`[Context] Listener ${col} error:`, err);
          if (isPermissionError(err)) denyAccess();
        },
      );

      unsubscribeMarker = repo.watchDoc(MIGRATION_DOC[0], MIGRATION_DOC[1],
        (marker) => setMigrationState(marker?.status || null),
        (err) => { if (isPermissionError(err)) denyAccess(); });

      // One-time move from the legacy shared document (needs a connection).
      if (navigator.onLine) {
        migrateLegacyStore({ db, doc, getDoc, runTransaction, writeBatch }, { user: user.email || user.name })
          .then((res) => {
            if (res.status === 'done') showNotice('✅ Data byla převedena do nové struktury.');
          })
          .catch((err) => {
            console.warn('[Context] Migration:', err);
            if (isPermissionError(err)) denyAccess();
          });
      }
    };

    const stopData = () => {
      unsubscribeData();
      unsubscribeMarker();
      unsubscribeData = () => {};
      unsubscribeMarker = () => {};
      setData(EMPTY_DATA);
      setPending({});
    };

    const unsubscribeAuth = firebaseAuth.onAuthChange((user) => {
      if (user) {
        setCurrentUserState(user);
        setIsAuthModalOpen(false);
        startData(user);
      } else {
        stopData();
        setCurrentUserState(null);
        setIsAuthModalOpen(true);
      }
      setAuthLoading(false);
    });

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribeAuth();
      stopData();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [repo, denyAccess, showNotice]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', themeMode === 'dark');
    root.classList.toggle('light', themeMode !== 'dark');
  }, [themeMode]);

  // ── Derived state ──────────────────────────────────────────
  const { jobs, jobItems: allJobItems, catalog, consumables, auditLogs } = data;
  const currentJob = jobs.find((j) => j.id === currentJobId)
    || jobs.find((j) => j.status === 'ACTIVE')
    || jobs[0]
    || null;
  const jobItems = useMemo(
    () => (currentJob ? allJobItems.filter((i) => i.jobId === currentJob.id) : []),
    [allJobItems, currentJob],
  );
  const hasPendingWrites = Object.values(pending).some(Boolean);
  const syncStatus = accessDenied ? 'error'
    : isOffline ? 'offline'
      : (hasPendingWrites || migrationState === 'running') ? 'syncing'
        : 'synced';

  const setCurrentUser = (user) => {
    setCurrentUserState(user);
    if (user) setActiveTab('dashboard');
  };

  const isAdmin = () => true; // All users are admins for this phase
  const canEditPacking = () => true;
  const userRole = currentUser?.role || 'USER';

  const setCurrentJobId = (jobId) => {
    try { localStorage.setItem(CURRENT_JOB_KEY, jobId || ''); } catch { /* private mode */ }
    setCurrentJobIdState(jobId || '');
  };

  // ── Actions (same API as before) ───────────────────────────
  const jobOfItem = (itemId) => {
    const item = allJobItems.find((i) => i.id === itemId);
    return item ? jobs.find((j) => j.id === item.jobId) : null;
  };
  const archivedNotice = () => showNotice('🔒 Zakázka je archivovaná. Pro úpravy ji nejprve obnovte.');
  const withItemJob = (itemId, fn) => {
    const job = jobOfItem(itemId);
    if (job?.status === 'ARCHIVED') { archivedNotice(); return null; }
    return fn(job?.mode || 'LOADING');
  };

  const updateItemQuantity = (itemId, delta) => withItemJob(itemId, (mode) => actions.updateItemQuantity(itemId, delta, mode));
  const setItemExactQuantity = (itemId, qty) => withItemJob(itemId, (mode) => actions.setItemExactQuantity(itemId, qty, mode));
  const setItemLoadedOrPacked = (itemId) => withItemJob(itemId, (mode) => actions.setItemLoadedOrPacked(itemId, mode));
  const setItemPending = (itemId) => withItemJob(itemId, (mode) => actions.setItemPending(itemId, mode));
  const toggleItemStatus = (itemId) => withItemJob(itemId, (mode) => actions.toggleItemStatus(itemId, mode));

  const deleteJobItem = (itemId) => withItemJob(itemId, () => {
    const removed = actions.deleteJobItem(itemId);
    if (removed) showNotice('🗑️ Položka byla odebrána ze zakázky.', 3500);
    return removed;
  });

  const reportItemDamage = (itemId, severity, notes, photoUrl) => {
    withItemJob(itemId, () => actions.reportItemDamage(itemId, severity, notes, photoUrl));
    setDamageReportItem(null);
  };

  const addAdHocItem = (name, category, quantity) => {
    if (!currentJob) return;
    if (currentJob.status === 'ARCHIVED') { archivedNotice(); return; }
    actions.addAdHocItem(currentJob.id, name, category, quantity);
    setIsAdHocModalOpen(false);
  };

  const addCatalogItemToJob = (catalogItem) => {
    if (!currentJob) return;
    if (currentJob.status === 'ARCHIVED') { archivedNotice(); return; }
    actions.addCatalogItemToJob(currentJob.id, catalogItem);
  };

  const finishJob = (jobId) => {
    actions.setJobStatus(jobId, 'ARCHIVED');
    if (currentJob?.id === jobId) {
      const next = jobs.find((j) => j.status === 'ACTIVE' && j.id !== jobId);
      if (next) setCurrentJobId(next.id);
    }
    showNotice('📁 Zakázka byla uzavřena a přesunuta do archivu.');
  };

  const reactivateJob = (jobId) => {
    actions.setJobStatus(jobId, 'ACTIVE');
    showNotice('⚡ Zakázka byla obnovena z archivu.');
  };

  const updateJob = (jobId, jobData) => {
    actions.updateJob(jobId, jobData);
    setEditingJob(null);
  };

  const duplicateJobAsTemplate = (sourceJobId, newJobData) => {
    const job = actions.duplicateJobAsTemplate(sourceJobId, newJobData);
    if (job) setCurrentJobId(job.id);
    setTemplateJob(null);
    setActiveTab('packing');
  };

  const createJob = (jobData) => {
    const job = actions.createJob(jobData);
    setCurrentJobId(job.id);
    setActiveTab('packing');
    setIsNewJobModalOpen(false);
  };

  const deleteJob = (jobId) => {
    actions.deleteJob(jobId);
    if (currentJob?.id === jobId) setCurrentJobId('');
  };

  const toggleJobMode = () => {
    if (!currentJob) return;
    if (currentJob.status === 'ARCHIVED') { archivedNotice(); return; }
    actions.toggleJobMode(currentJob.id);
  };

  const createCatalogItem = (itemData) => actions.createCatalogItem(itemData);
  const updateCatalogItem = (catalogId, itemData) => actions.updateCatalogItem(catalogId, itemData);
  const deleteCatalogItem = (catalogId) => actions.deleteCatalogItem(catalogId);
  const updateConsumableState = (consumableId, newState) => actions.updateConsumableState(consumableId, newState);

  /** Waits until every local change is on the server. */
  const forceSyncAll = async () => {
    if (accessDenied) { denyAccess(); return; }
    if (!navigator.onLine) {
      showNotice('📴 Jste offline. Změny jsou uložené v telefonu a odešlou se po připojení.');
      return;
    }
    showNotice('⏳ Odesílám změny do cloudu…', 0);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));
    try {
      await Promise.race([repo.waitForSync(), timeout]);
      showNotice('✅ Všechny změny jsou uložené v cloudu.');
    } catch {
      showNotice('⚠️ Odeslání trvá déle než obvykle. Změny zůstávají uložené v telefonu.');
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        jobs,
        currentJobId: currentJob?.id || '',
        setCurrentJobId,
        currentJob,
        jobItems,
        allJobItems,
        authLoading,
        vehicles: INITIAL_VEHICLES,
        consumables,
        auditLogs,
        catalog,
        userRole,
        currentUser,
        setCurrentUser,
        isAdmin,
        canEditPacking,
        isOffline,
        setIsOffline,
        syncStatus,
        syncNotice,
        hasPendingWrites,
        migrationState,
        themeMode,
        setThemeMode,
        activeTab,
        setActiveTab,
        selectedStatusFilter,
        setSelectedStatusFilter,
        searchQuery,
        setSearchQuery,

        // Actions
        updateItemQuantity,
        setItemExactQuantity,
        setItemLoadedOrPacked,
        setItemPending,
        toggleItemStatus,
        deleteJobItem,
        reportItemDamage,
        addAdHocItem,
        addCatalogItemToJob,
        finishJob,
        reactivateJob,
        updateJob,
        duplicateJobAsTemplate,
        createCatalogItem,
        updateCatalogItem,
        deleteCatalogItem,
        updateConsumableState,
        toggleJobMode,
        createJob,
        deleteJob,
        forceSyncAll,

        // Modals & Editing
        isNewJobModalOpen,
        setIsNewJobModalOpen,
        isAdHocModalOpen,
        setIsAdHocModalOpen,
        isScannerModalOpen,
        setIsScannerModalOpen,
        damageReportItem,
        setDamageReportItem,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        isProtocolModalOpen,
        setIsProtocolModalOpen,
        editingJob,
        setEditingJob,
        templateJob,
        setTemplateJob,

        // Context Menu State
        contextMenu,
        setContextMenu,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => useContext(InventoryContext);
