import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { firebaseAuth } from '../services/firebaseAuth';
import { createFirestoreRepo } from '../services/inventoryRepo';
import { createInventoryActions } from '../services/inventoryActions';
import { createStockActions } from '../services/stockActions';
import { createVehicleActions } from '../services/vehicleActions';
import { availability } from '../domain/stock';
import { buildAlerts } from '../domain/alerts';
import { todayIso } from '../domain/vehicles';
import { migrateLegacyStore, MIGRATION_DOC } from '../services/migration';
import { db, doc, getDoc, runTransaction, writeBatch } from '../services/firebase';
import { CATEGORIES, getCategoryMeta } from '../utils/categoryIcons';

const InventoryContext = createContext();

const CURRENT_JOB_KEY = 'blp_current_job_id_v2';
const EMPTY_DATA = {
  jobs: [], jobItems: [], catalog: [], consumables: [], auditLogs: [],
  stockLevels: [], stockUnits: [], movements: [], stocktakes: [], stocktakeLines: [],
  vehicles: [],
};

// Stable, readable order (Firestore returns documents by ID).
// Older data uses Czech category names; getCategoryMeta maps them to the same IDs.
const categoryRank = (cat) => {
  const id = getCategoryMeta(cat)?.id ?? cat;
  const idx = (CATEGORIES || []).findIndex((c) => c.id === id);
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
  movements: (a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')),
  stocktakes: (a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')),
  stockLevels: () => 0,
  stockUnits: (a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'cs', { numeric: true }),
  stocktakeLines: byCategoryThenName,
  vehicles: (a, b) => (a.active === false) - (b.active === false) || (a.order || 0) - (b.order || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'cs'),
};

const CORE_COLLECTIONS = ['jobs', 'jobItems', 'catalog'];
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
  const [migrationInfo, setMigrationInfo] = useState(null); // full marker (counts) for Settings
  const [themeMode, setThemeMode] = useState('light');
  const [syncNotice, setSyncNotice] = useState(null);

  // Filters & Nav state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [warehouseTab, setWarehouseTab] = useState('stock'); // stock | stocktake | movements | catalog
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('REMAINING');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [damageReportItem, setDamageReportItem] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  // Where a tap on an alert leads inside a screen: { type: 'vehicle' | 'stockItem', id }.
  const [navFocus, setNavFocus] = useState(null);
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [templateJob, setTemplateJob] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [photoViewerItem, setPhotoViewerItem] = useState(null);
  // Archived job opened on purpose in this session (see currentJob below).
  const [openedArchivedId, setOpenedArchivedId] = useState('');
  const [finishingJob, setFinishingJob] = useState(null); // job shown in the "finish job" guide

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

  const stock = useMemo(() => createStockActions({
    repo,
    getState: () => dataRef.current,
    getActor: () => actorRef.current,
  }), [repo]);

  const vehicleActions = useMemo(() => createVehicleActions({
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
          // Only the core collections decide about access; a refused warehouse
          // collection (e.g. rules not published yet) must not block the jobs.
          if (isPermissionError(err) && CORE_COLLECTIONS.includes(col)) denyAccess();
        },
      );

      unsubscribeMarker = repo.watchDoc(MIGRATION_DOC[0], MIGRATION_DOC[1],
        (marker) => { setMigrationState(marker?.status || null); setMigrationInfo(marker); },
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
  const {
    jobs, jobItems: allJobItems, catalog, consumables, auditLogs,
    stockLevels, stockUnits, movements, stocktakes, stocktakeLines, vehicles,
  } = data;
  // The chosen job; an archived one only when it was opened on purpose in this
  // session (from the archive). Otherwise the first active job, or none at all —
  // an old finished job must not look like the current one.
  const chosenJob = jobs.find((j) => j.id === currentJobId);
  const currentJob = (chosenJob && (chosenJob.status !== 'ARCHIVED' || chosenJob.id === openedArchivedId) ? chosenJob : null)
    || jobs.find((j) => j.status === 'ACTIVE')
    || null;
  // An archived job opened from the archive is only for looking: once the user
  // goes to another screen it is no longer the current job.
  useEffect(() => {
    if (activeTab !== 'packing' && !isProtocolModalOpen && openedArchivedId) setOpenedArchivedId('');
  }, [activeTab, isProtocolModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const jobItems = useMemo(
    () => (currentJob ? allJobItems.filter((i) => i.jobId === currentJob.id) : []),
    [allJobItems, currentJob],
  );

  // Everything that needs attention (Upozornění): vehicles, warehouse, jobs, Brácha.
  const today = todayIso();
  const alerts = useMemo(() => buildAlerts({ ...data, jobItems: allJobItems }, today), [data, allJobItems, today]);
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
    setOpenedArchivedId(jobId || '');
  };
  /** Opens the place an alert points to (see domain/alerts.js `target`). */
  const openTarget = (target) => {
    if (!target) return;
    if (target.jobId) setCurrentJobId(target.jobId);
    if (target.warehouseTab) setWarehouseTab(target.warehouseTab);
    if (target.vehicleId) setNavFocus({ type: 'vehicle', id: target.vehicleId });
    else if (target.catalogId) setNavFocus({ type: 'stockItem', id: target.catalogId });
    setActiveTab(target.tab);
  };

  /** After a job is finished: switch to another active job, or to none. */
  const leaveJob = (jobId) => {
    if (currentJob?.id !== jobId) return;
    const next = jobs.find((j) => j.status === 'ACTIVE' && j.id !== jobId);
    setCurrentJobId(next ? next.id : '');
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
  const setItemRequestedQuantity = (itemId, qty) => withItemJob(itemId, (mode) => actions.setItemRequestedQuantity(itemId, qty, mode));
  const setItemLoadedOrPacked = (itemId) => withItemJob(itemId, (mode) => actions.setItemLoadedOrPacked(itemId, mode));
  const setItemPending = (itemId) => withItemJob(itemId, (mode) => actions.setItemPending(itemId, mode));
  const toggleItemStatus = (itemId) => withItemJob(itemId, (mode) => actions.toggleItemStatus(itemId, mode));

  /** Returns the removed item so the caller can offer "Vrátit" (restoreJobItem). */
  const deleteJobItem = (itemId) => withItemJob(itemId, () => actions.deleteJobItem(itemId));
  const restoreJobItem = (item) => actions.restoreJobItem(item);

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
    // Warn when the warehouse does not have enough pieces in the job's dates.
    const ids = catalogItem.isBundle
      ? (catalogItem.bundleItems || []).map((s) => catalog.find((c) => c.name.toLowerCase().trim() === String(s.name).toLowerCase().trim())?.id).filter(Boolean)
      : [catalogItem.id];
    setTimeout(() => {
      const short = ids.map((id) => ({ id, a: availability(id, currentJob, { jobs: dataRef.current.jobs, jobItems: dataRef.current.jobItems, levels: dataRef.current.stockLevels }) }))
        .filter(({ a }) => a && a.short > 0);
      if (short.length) {
        const first = short[0];
        const name = catalog.find((c) => c.id === first.id)?.name || '';
        showNotice(`⚠️ ${name}: v termínu zakázky chybí ${first.a.short} ks (máte ${first.a.owned}, jinde rezervováno ${first.a.reservedElsewhere}).`, 6000);
      }
    }, 0);
  };

  // Callers show their own confirmation / undo toast (see FinishJobSheet).
  const finishJob = (jobId) => {
    actions.setJobStatus(jobId, 'ARCHIVED');
    leaveJob(jobId);
  };

  const reactivateJob = (jobId) => {
    actions.setJobStatus(jobId, 'ACTIVE');
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

  /**
   * Move the current job to another phase and keep the warehouse in step:
   *   Rigging → Derigging : loaded equipment is issued from the warehouse
   *   Derigging → Rigging : the issue is cancelled
   *   Derigging → Restock : packed items are prefilled as restocked
   */
  const changeJobPhase = (mode, jobId = currentJob?.id) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    if (job.status === 'ARCHIVED') { archivedNotice(); return; }
    const stockTracked = stockLevels.length > 0;
    if (mode === 'RESTOCK') { stock.startRestock(job.id); return; }
    if (mode === 'DERIGGING' && (job.mode || 'LOADING') === 'LOADING' && stockTracked) stock.issueJob(job.id);
    if (mode === 'LOADING' && job.mode === 'DERIGGING') stock.unissueJob(job.id);
    actions.setJobMode(job.id, mode);
  };
  const toggleJobMode = () => changeJobPhase(currentJob?.mode === 'DERIGGING' ? 'LOADING' : 'DERIGGING');

  /** Finish restock: stock updated, job archived. */
  const finishRestock = (jobId) => {
    const plan = stock.finishRestock(jobId);
    leaveJob(jobId);
    return plan;
  };

  const availabilityFor = (catalogId, job = currentJob) =>
    availability(catalogId, job, { jobs, jobItems: allJobItems, levels: stockLevels });

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
        vehicles,
        createVehicle: vehicleActions.createVehicle,
        updateVehicle: vehicleActions.updateVehicle,
        setVehicleActive: vehicleActions.setVehicleActive,
        deleteVehicle: vehicleActions.deleteVehicle,
        alerts,
        navFocus,
        setNavFocus,
        openTarget,
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
        migrationInfo,
        logAudit: actions.audit,
        themeMode,
        setThemeMode,
        activeTab,
        setActiveTab,
        warehouseTab,
        setWarehouseTab,
        selectedStatusFilter,
        setSelectedStatusFilter,
        searchQuery,
        setSearchQuery,

        // Actions
        updateItemQuantity,
        setItemExactQuantity,
        setItemRequestedQuantity,
        setItemLoadedOrPacked,
        setItemPending,
        toggleItemStatus,
        deleteJobItem,
        restoreJobItem,
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
        changeJobPhase,
        finishRestock,
        availabilityFor,

        // Warehouse
        stockLevels,
        stockUnits,
        movements,
        stocktakes,
        stocktakeLines,
        stock,
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
        photoViewerItem,
        setPhotoViewerItem,
        finishingJob,
        setFinishingJob,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => useContext(InventoryContext);
