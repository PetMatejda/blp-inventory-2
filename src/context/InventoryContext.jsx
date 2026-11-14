import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { firebaseDb } from '../services/firebaseDb';
import { firebaseAuth } from '../services/firebaseAuth';

const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
  const [jobs, setJobs] = useState([]);
  const [currentJobId, setCurrentJobIdState] = useState('');
  const [jobItems, setJobItems] = useState([]);
  const [allJobItems, setAllJobItems] = useState([]); // ALL items across ALL jobs — for dashboard counts
  const [vehicles, setVehicles] = useState([]);
  const [consumables, setConsumables] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [currentUser, setCurrentUserState] = useState(() => {
    try {
      const saved = localStorage.getItem('blp_auth_user_v2');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(() => {
    try {
      return !localStorage.getItem('blp_auth_user_v2');
    } catch {
      return true;
    }
  });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [themeMode, setThemeMode] = useState('light');

  // Cloud Sync state & indicator
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'offline' | 'error'
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

  // Job Editing & Template Modals
  const [editingJob, setEditingJob] = useState(null);
  const [templateJob, setTemplateJob] = useState(null);

  // Global Context Menu state (Long Press)
  const [contextMenu, setContextMenu] = useState(null);

  // Tell the user when the cloud refuses access (account not on the approved list)
  const reportCloudError = useCallback((res) => {
    if (!res?.success && /permission|insufficient/i.test(res?.error || '')) {
      setSyncStatus('error');
      setSyncNotice('🔒 Tento účet nemá přístup k datům BLP. Požádejte správce o přidání vašeho e-mailu.');
      return true;
    }
    return false;
  }, []);

  // Read local cache into React state
  const refreshDataFromLocal = useCallback(() => {
    setJobs(storageService.getJobs());
    const savedJobId = storageService.getCurrentJobId();
    setCurrentJobIdState(savedJobId);
    setJobItems(storageService.getJobItems(savedJobId));
    setAllJobItems(storageService.getJobItems(null)); // null = all jobs
    setVehicles(storageService.getVehicles());
    setConsumables(storageService.getConsumables());
    setAuditLogs(storageService.getAuditLogs());
    setCatalog(storageService.getCatalog());
  }, []);

  useEffect(() => {
    // Step 1: Initialize local fallback storage (version v5 ensures clean cache)
    storageService.init();
    refreshDataFromLocal();

    // Step 2: Real-time Firestore subscription (instant multi-device sync).
    // Started once a user is signed in (Step 4): Firestore rules reject
    // unauthenticated listeners and a rejected listener never recovers.
    let unsubscribeCloud = () => {};
    const startCloudListener = () => {
      unsubscribeCloud();
      unsubscribeCloud = firebaseDb.subscribeToCloud(() => {
        console.log('[Context] 🔔 Realtime remote update received from Firestore.');
        setSyncStatus('synced');
        refreshDataFromLocal();
      });
    };

    // Step 3: The startup cloud pull happens in Step 4, once Firebase confirms a signed-in user.
    setSyncStatus('syncing');

    // Step 4: Subscribe to Firebase Auth state
    const unsubscribeAuth = firebaseAuth.onAuthChange((user) => {
      if (user) {
        setCurrentUserState(user);
        storageService.setUserRole(user.role);
        setIsAuthModalOpen(false);
        startCloudListener();
        // Data reads require a signed-in, approved account — pull now that we have one.
        storageService.flushPendingSync().then(() => firebaseDb.pullFromCloud()).then((res) => {
          if (reportCloudError(res)) return;
          if (res.success) refreshDataFromLocal();
          setSyncStatus(res.success ? 'synced' : 'offline');
        });
      } else {
        unsubscribeCloud();
        unsubscribeCloud = () => {};
        setCurrentUserState(null);
        setIsAuthModalOpen(true);
        setSyncStatus('offline');
      }
      setAuthLoading(false);
    });

    // Step 5: Refresh on tab visibility — always flush local changes first
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        if (storageService.isSyncInProgress && storageService.isSyncInProgress()) {
          console.log('[Context] Visibility changed but sync is in progress, skipping pull');
          return;
        }
        await storageService.flushPendingSync();
        firebaseDb.pullFromCloud().then((res) => {
          if (res.success) refreshDataFromLocal();
          setSyncStatus(res.success ? 'synced' : 'offline');
        });
      }
    };

    const handleOnline = async () => {
      setIsOffline(false);
      setSyncStatus('syncing');
      await storageService.flushPendingSync();
      firebaseDb.pullFromCloud().then((res) => {
        if (res.success) refreshDataFromLocal();
        setSyncStatus(res.success ? 'synced' : 'offline');
      });
    };

    const handleOffline = () => {
      setIsOffline(true);
      setSyncStatus('offline');
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribeCloud();
      unsubscribeAuth();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };

  }, [refreshDataFromLocal, reportCloudError]);


  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [themeMode]);

  const setCurrentUser = (user) => {
    setCurrentUserState(user);
    if (user) {
      storageService.setUserRole(user.role);
      setActiveTab('dashboard');
    }
  };

  const isAdmin = () => true; // All users are admins for this phase
  const canEditPacking = () => true;

  const userRole = currentUser?.role || 'USER';

  const setCurrentJobId = (jobId) => {
    storageService.setCurrentJobId(jobId);
    setCurrentJobIdState(jobId);
    setJobItems(storageService.getJobItems(jobId));
    // Also refresh allJobItems so dashboard counts stay accurate after navigation
    setAllJobItems(storageService.getJobItems(null));
  };

  const currentJob = jobs.find(j => j.id === currentJobId) || jobs[0] || null;

  // Helper: refresh UI and push to cloud after any mutation
  const afterMutation = () => {
    refreshDataFromLocal();
    // setSyncStatus shows 'syncing' until cloud confirms
    // storageService.syncToCloud() is debounced at 50ms
  };

  // Actions with Cloud Sync queue integration
  const updateItemQuantity = (itemId, delta) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const mode = currentJob?.mode || 'LOADING';
    const actorName = getActorName();
    storageService.updateItemQuantity(itemId, delta, actorName, mode);
    afterMutation();
  };

  const setItemExactQuantity = (itemId, exactQty) => {
    if (currentJob?.status === 'ARCHIVED') return;
    const allItems = storageService.getJobItems(currentJobId);
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    const delta = exactQty - item.quantityLoaded;
    updateItemQuantity(itemId, delta);
  };

  const setItemLoadedOrPacked = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const mode = currentJob?.mode || 'LOADING';
    const actorName = getActorName();
    storageService.setItemLoadedOrPacked(itemId, actorName, mode);
    afterMutation();
  };

  const setItemPending = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const mode = currentJob?.mode || 'LOADING';
    const actorName = getActorName();
    storageService.setItemPending(itemId, actorName, mode);
    afterMutation();
  };

  const toggleItemStatus = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const mode = currentJob?.mode || 'LOADING';
    const actorName = getActorName();
    storageService.toggleItemStatus(itemId, actorName, mode);
    afterMutation();
  };

  const deleteJobItem = (itemId, itemData = null) => {
    if (currentJob?.status === 'ARCHIVED') {
      alert('Tato zakázka je archivována. Pro odebírání položek ji nejprve obnovte tlačítkem Obnovit v kontextovém menu zakázky.');
      return;
    }
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.deleteJobItem(itemId, actorName, itemData);
    afterMutation();
    setSyncNotice('🗑️ Položka byla odebrána ze zakázky a smazána z cloudu.');
    setTimeout(() => setSyncNotice(null), 3500);
  };

  const reportItemDamage = (itemId, severity, notes, photoUrl) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.reportItemDamage(itemId, severity, notes, photoUrl, actorName);
    afterMutation();
    setDamageReportItem(null);
  };

  const addAdHocItem = (name, category, quantity) => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.addAdHocItem(currentJobId, name, category, 'v1', quantity, actorName);
    afterMutation();
    setIsAdHocModalOpen(false);
  };

  const addCatalogItemToJob = (catalogItem) => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.addCatalogItemToJob(currentJobId, catalogItem, 'v1', actorName);
    afterMutation();
  };

  const getActorName = () => {
    if (currentUser?.name) {
      return `${currentUser.name} (${currentUser.role || 'USER'})`;
    }
    return 'Neznámý uživatel';
  };

  // Job Status & Template Operations
  const finishJob = (jobId) => {
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.finishJob(jobId, actorName);

    // If the finished job was the currently selected job, switch current selection to another active job
    const allJobs = storageService.getJobs();
    const otherActiveJobs = allJobs.filter(j => j.status === 'ACTIVE' && j.id !== jobId);
    if (currentJobId === jobId && otherActiveJobs.length > 0) {
      storageService.setCurrentJobId(otherActiveJobs[0].id);
      setCurrentJobIdState(otherActiveJobs[0].id);
    }

    afterMutation();
    setSyncNotice('📁 Zakázka byla úspěšně uzavřena a přesunuta do Archivu!');
    setTimeout(() => setSyncNotice(null), 4000);
  };

  const reactivateJob = (jobId) => {
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.reactivateJob(jobId, actorName);
    afterMutation();
    setSyncNotice('⚡ Zakázka byla obnovena z archivu do aktivních!');
    setTimeout(() => setSyncNotice(null), 4000);
  };

  const updateJob = (jobId, jobData) => {
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.updateJob(jobId, jobData, actorName);
    afterMutation();
    setEditingJob(null);
  };

  const duplicateJobAsTemplate = (sourceJobId, newJobData) => {
    setSyncStatus('syncing');
    const actorName = getActorName();
    const newJob = storageService.duplicateJobAsTemplate(sourceJobId, newJobData, actorName);
    afterMutation();
    if (newJob) {
      setCurrentJobId(newJob.id);
    }
    setTemplateJob(null);
    setActiveTab('packing');
  };


  // Master Catalog CRUD (Restricted to ADMIN)
  const createCatalogItem = (itemData) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.createCatalogItem(itemData, actorName);
    afterMutation();
  };

  const updateCatalogItem = (catalogId, itemData) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.updateCatalogItem(catalogId, itemData, actorName);
    afterMutation();
  };

  const deleteCatalogItem = (catalogId) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.deleteCatalogItem(catalogId, actorName);
    afterMutation();
  };

  const updateConsumableState = (consumableId, newState) => {
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.updateConsumableState(consumableId, newState, actorName);
    afterMutation();
  };

  const toggleJobMode = () => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.toggleJobMode(currentJobId, actorName);
    afterMutation();
  };

  const createJob = (jobData) => {
    if (!isAdmin()) {
      alert('Vytváření zakázek vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = getActorName();
    const newJob = storageService.createJob(jobData, actorName);
    afterMutation();
    setCurrentJobId(newJob.id);
    setActiveTab('packing');
    setIsNewJobModalOpen(false);
  };

  const deleteJob = (jobId) => {
    if (!isAdmin()) {
      alert('Mazání zakázek vyžaduje oprávnění ADMIN.');
      return;
    }
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.deleteJob(jobId, actorName);
    afterMutation();
  };



  const forceSyncAll = async () => {
    setSyncStatus('syncing');
    await storageService.flushPendingSync();
    const pullRes = await firebaseDb.pullFromCloud();
    refreshDataFromLocal();
    if (reportCloudError(pullRes)) return;
    setSyncStatus(pullRes.success ? 'synced' : 'offline');
    if (pullRes.success) {
      setSyncNotice('🔥 Data byla úspěšně synchronizována s cloudem!');
    } else {
      setSyncNotice(`⚠️ Chyba synchronizace: ${pullRes.error || 'Zkontrolujte připojení'}`);
    }
    setTimeout(() => setSyncNotice(null), 4000);
  };


  const resetDemoData = () => {
    storageService.resetDemoData();
    refreshDataFromLocal();
  };

  return (
    <InventoryContext.Provider
      value={{
        jobs,
        currentJobId,
        setCurrentJobId,
        currentJob,
        jobItems,
        allJobItems,
        authLoading,
        vehicles,
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

        resetDemoData,

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
