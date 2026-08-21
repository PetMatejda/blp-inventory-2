import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { cloudSyncService } from '../services/cloudSyncService';
import { firebaseDb } from '../services/firebaseDb';
import { firebaseAuth } from '../services/firebaseAuth';

const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
  const [jobs, setJobs] = useState([]);
  const [currentJobId, setCurrentJobIdState] = useState('');
  const [jobItems, setJobItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [consumables, setConsumables] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [currentUser, setCurrentUserState] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [themeMode, setThemeMode] = useState('dark');

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
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMasterCatalogModalOpen, setIsMasterCatalogModalOpen] = useState(false);

  // Job Editing & Template Modals
  const [editingJob, setEditingJob] = useState(null);
  const [templateJob, setTemplateJob] = useState(null);

  // Global Context Menu state (Long Press)
  const [contextMenu, setContextMenu] = useState(null);

  // Read local cache into React state (WITHOUT triggering cloud push loop)
  const refreshDataFromLocal = useCallback(() => {
    setJobs(storageService.getJobs());
    const savedJobId = storageService.getCurrentJobId();
    setCurrentJobIdState(savedJobId);
    setJobItems(storageService.getJobItems(savedJobId));
    setVehicles(storageService.getVehicles());
    setConsumables(storageService.getConsumables());
    setAuditLogs(storageService.getAuditLogs());
    setCatalog(storageService.getCatalog());
  }, []);

  useEffect(() => {
    // Step 1: Initialize from local defaults (if first run)
    // Does NOT push to cloud — avoids overwriting remote changes on startup
    storageService.init();

    // Step 2: Pull latest from cloud BEFORE showing data
    // This ensures we always start with the freshest server state
    setSyncStatus('syncing');
    firebaseDb.pullFromCloud().then((res) => {
      if (res.success) {
        console.log('[Context] Startup cloud pull OK, refreshing UI.');
      } else {
        console.warn('[Context] Startup cloud pull failed (offline?), using local cache.');
      }
      // Always refresh from local (which now has cloud data if pull succeeded)
      refreshDataFromLocal();
      setSyncStatus(res.success ? 'synced' : 'offline');
    });

    // Step 3: Subscribe to real-time Firestore updates
    // Only fires for changes from OTHER devices (echo prevention in firebaseDb.js)
    const unsubscribeCloud = firebaseDb.subscribeToCloud(() => {
      console.log('[Context] Remote update received, refreshing UI.');
      setSyncStatus('synced');
      refreshDataFromLocal();
    });

    // Step 4: Subscribe to Firebase Auth state
    const unsubscribeAuth = firebaseAuth.onAuthChange((user) => {
      if (user) {
        setCurrentUserState(user);
        storageService.setUserRole(user.role);
      } else {
        setCurrentUserState(null);
        setIsAuthModalOpen(true);
      }
    });

    // Step 5: Pull fresh data when user switches back to the app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setSyncStatus('syncing');
        firebaseDb.pullFromCloud().then((res) => {
          if (res.success) {
            refreshDataFromLocal();
          }
          setSyncStatus(res.success ? 'synced' : 'offline');
        });
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
      setSyncStatus('syncing');
      // On coming back online: pull first, then push our pending changes
      firebaseDb.pullFromCloud().then((pullRes) => {
        if (pullRes.success) refreshDataFromLocal();
        cloudSyncService.syncPendingChanges().then(res => {
          setSyncStatus('synced');
          if (res.synced > 0) {
            setSyncNotice(`Synchronizováno ${res.synced} offline změn s Firebase cloudem.`);
            setTimeout(() => setSyncNotice(null), 3500);
          }
        });
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

  const isAdmin = () => currentUser?.role === 'ADMIN';
  const canEditPacking = () => true;

  const userRole = currentUser?.role || 'USER';

  const setCurrentJobId = (jobId) => {
    storageService.setCurrentJobId(jobId);
    setCurrentJobIdState(jobId);
    setJobItems(storageService.getJobItems(jobId));
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

  // Job Status & Template Operations (Restricted to ADMIN)
  const finishJob = (jobId) => {
    if (!isAdmin()) {
      alert('Ukončení a archivace zakázky vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.finishJob(jobId, actorName);
    afterMutation();
  };

  const reactivateJob = (jobId) => {
    if (!isAdmin()) {
      alert('Obnovení zakázky vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.reactivateJob(jobId, actorName);
    afterMutation();
  };

  const updateJob = (jobId, jobData) => {
    if (!isAdmin()) {
      alert('Úprava zakázky vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.updateJob(jobId, jobData, actorName);
    afterMutation();
    setEditingJob(null);
  };

  const duplicateJobAsTemplate = (sourceJobId, newJobData) => {
    if (!isAdmin()) {
      alert('Vytváření kopií zakázky vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    const newJob = storageService.duplicateJobAsTemplate(sourceJobId, newJobData, actorName);
    afterMutation();
    setCurrentJobId(newJob.id);
    setTemplateJob(null);
  };

  // Master Catalog CRUD (Restricted to ADMIN)
  const createCatalogItem = (itemData) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.createCatalogItem(itemData, actorName);
    afterMutation();
  };

  const updateCatalogItem = (catalogId, itemData) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.updateCatalogItem(catalogId, itemData, actorName);
    afterMutation();
  };

  const deleteCatalogItem = (catalogId) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.deleteCatalogItem(catalogId, actorName);
    afterMutation();
  };

  const updateConsumableState = (consumableId, newState) => {
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.updateConsumableState(consumableId, newState, actorName);
    afterMutation();
  };

  const toggleJobMode = () => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.toggleJobMode(currentJobId, actorName);
    afterMutation();
  };

  const createJob = (jobData) => {
    if (!isAdmin()) {
      alert('Vytváření zakázek vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    const newJob = storageService.createJob(jobData, actorName);
    afterMutation();
    setCurrentJobId(newJob.id);
    setIsNewJobModalOpen(false);
  };

  const forceSyncAll = async () => {
    setSyncStatus('syncing');
    const pushRes = await storageService.syncToCloudManual();
    const pullRes = await storageService.syncFromCloudManual();
    refreshDataFromLocal();
    setSyncStatus('synced');
    if (pushRes.success && pullRes.success) {
      setSyncNotice('🔥 Cloud plně synchronizován s databází Firebase!');
    } else {
      setSyncNotice(`⚠️ Pozor: ${pushRes.error || pullRes.error || 'Zkontrolujte připojení k internetu'}`);
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
        isProtocolModalOpen,
        setIsProtocolModalOpen,
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
