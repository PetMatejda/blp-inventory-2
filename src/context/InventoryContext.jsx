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
  const [currentUser, setCurrentUserState] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // true until first Firebase auth response
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
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMasterCatalogModalOpen, setIsMasterCatalogModalOpen] = useState(false);

  // Job Editing & Template Modals
  const [editingJob, setEditingJob] = useState(null);
  const [templateJob, setTemplateJob] = useState(null);

  // Global Context Menu state (Long Press)
  const [contextMenu, setContextMenu] = useState(null);

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

    // Step 2: Real-time Firestore subscription (instant multi-device sync)
    const unsubscribeCloud = firebaseDb.subscribeToCloud(() => {
      console.log('[Context] 🔔 Realtime remote update received from Firestore.');
      setSyncStatus('synced');
      refreshDataFromLocal();
    });

    // Step 3: Pull fresh state from cloud on startup
    setSyncStatus('syncing');
    firebaseDb.pullFromCloud().then((res) => {
      if (res.success) {
        console.log('[Context] Startup cloud pull OK.');
      }
      refreshDataFromLocal();
      setSyncStatus(res.success ? 'synced' : 'offline');
    });

    // Step 4: Subscribe to Firebase Auth state
    const unsubscribeAuth = firebaseAuth.onAuthChange((user) => {
      if (user) {
        setCurrentUserState(user);
        storageService.setUserRole(user.role);
        setIsAuthModalOpen(false);
      } else {
        setCurrentUserState(null);
        setIsAuthModalOpen(true);
      }
      setAuthLoading(false);
    });

    // Step 5: Refresh on tab visibility / focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        firebaseDb.pullFromCloud().then((res) => {
          if (res.success) refreshDataFromLocal();
          setSyncStatus(res.success ? 'synced' : 'offline');
        });
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
      setSyncStatus('syncing');
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
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribeCloud();
      unsubscribeAuth();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };

  }, [refreshDataFromLocal]);


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
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
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
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.setItemLoadedOrPacked(itemId, actorName, mode);
    afterMutation();
  };

  const setItemPending = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const mode = currentJob?.mode || 'LOADING';
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.setItemPending(itemId, actorName, mode);
    afterMutation();
  };

  const toggleItemStatus = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const mode = currentJob?.mode || 'LOADING';
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.toggleItemStatus(itemId, actorName, mode);
    afterMutation();
  };

  const deleteJobItem = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.deleteJobItem(itemId, actorName);
    afterMutation();
  };

  const reportItemDamage = (itemId, severity, notes, photoUrl) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.reportItemDamage(itemId, severity, notes, photoUrl, actorName);
    afterMutation();
    setDamageReportItem(null);
  };

  const addAdHocItem = (name, category, quantity) => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.addAdHocItem(currentJobId, name, category, 'v1', quantity, actorName);
    afterMutation();
    setIsAdHocModalOpen(false);
  };

  const addCatalogItemToJob = (catalogItem) => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.addCatalogItemToJob(currentJobId, catalogItem, 'v1', actorName);
    afterMutation();
  };

  const getActorName = () => {
    if (currentUser?.name) {
      return `${currentUser.name} (${currentUser.role || 'USER'})`;
    }
    return 'Petr M. (Lead Gaffer)';
  };

  // Job Status & Template Operations
  const finishJob = (jobId) => {
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.finishJob(jobId, actorName);
    afterMutation();
  };

  const reactivateJob = (jobId) => {
    setSyncStatus('syncing');
    const actorName = getActorName();
    storageService.reactivateJob(jobId, actorName);
    afterMutation();
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
    const pullRes = await firebaseDb.pullFromCloud();
    refreshDataFromLocal();
    setSyncStatus(pullRes.success ? 'synced' : 'offline');
    if (pullRes.success) {
      setSyncNotice('🔥 Data byla úspěšně stažena a synchronizována s cloudem!');
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
        isRoleModalOpen,
        setIsRoleModalOpen,

        isAuthModalOpen,
        setIsAuthModalOpen,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        isMasterCatalogModalOpen,
        setIsMasterCatalogModalOpen,
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
