import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const refreshDataFromLocal = () => {
    setJobs(storageService.getJobs());
    const savedJobId = storageService.getCurrentJobId();
    setCurrentJobIdState(savedJobId);
    setJobItems(storageService.getJobItems(savedJobId));
    setVehicles(storageService.getVehicles());
    setConsumables(storageService.getConsumables());
    setAuditLogs(storageService.getAuditLogs());
    setCatalog(storageService.getCatalog());
  };

  useEffect(() => {
    // Initial local cache setup on app startup
    storageService.init();
    refreshDataFromLocal();

    // 1. Subscribe to Realtime Firebase Firestore Cloud Database
    const unsubscribeCloud = firebaseDb.subscribeToCloud(() => {
      setSyncStatus('synced');
      refreshDataFromLocal();
    });

    // 2. Subscribe to Real Firebase Auth State Changes (Google OAuth & Email Auth)
    const unsubscribeAuth = firebaseAuth.onAuthChange((user) => {
      if (user) {
        setCurrentUserState(user);
        storageService.setUserRole(user.role);
      } else {
        setCurrentUserState(null);
        setIsAuthModalOpen(true);
      }
    });

    const handleOnline = () => {
      setIsOffline(false);
      setSyncStatus('syncing');
      cloudSyncService.syncPendingChanges().then(res => {
        setSyncStatus('synced');
        if (res.synced > 0) {
          setSyncNotice(`Synchronizováno ${res.synced} offline změn s Firebase cloudem.`);
          setTimeout(() => setSyncNotice(null), 3500);
        }
      });
    };
    const handleOffline = () => {
      setIsOffline(true);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribeCloud();
      unsubscribeAuth();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  // Actions with Cloud Sync queue integration
  const updateItemQuantity = (itemId, delta) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const mode = currentJob?.mode || 'LOADING';
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.updateItemQuantity(itemId, delta, actorName, mode);
    refreshDataFromLocal();
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
    refreshDataFromLocal();
  };

  const setItemPending = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const mode = currentJob?.mode || 'LOADING';
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.setItemPending(itemId, actorName, mode);
    refreshDataFromLocal();
  };

  const toggleItemStatus = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const mode = currentJob?.mode || 'LOADING';
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.toggleItemStatus(itemId, actorName, mode);
    refreshDataFromLocal();
  };

  const deleteJobItem = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.deleteJobItem(itemId, actorName);
    refreshDataFromLocal();
  };

  const reportItemDamage = (itemId, severity, notes, photoUrl) => {
    if (currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.reportItemDamage(itemId, severity, notes, photoUrl, actorName);
    refreshDataFromLocal();
    setDamageReportItem(null);
  };

  const addAdHocItem = (name, category, quantity) => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.addAdHocItem(currentJobId, name, category, 'v1', quantity, actorName);
    refreshDataFromLocal();
    setIsAdHocModalOpen(false);
  };

  const addCatalogItemToJob = (catalogItem) => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.addCatalogItemToJob(currentJobId, catalogItem, 'v1', actorName);
    refreshDataFromLocal();
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
    refreshDataFromLocal();
  };

  const reactivateJob = (jobId) => {
    if (!isAdmin()) {
      alert('Obnovení zakázky vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.reactivateJob(jobId, actorName);
    refreshDataFromLocal();
  };

  const updateJob = (jobId, jobData) => {
    if (!isAdmin()) {
      alert('Úprava zakázky vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.updateJob(jobId, jobData, actorName);
    refreshDataFromLocal();
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
    refreshDataFromLocal();
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
    refreshDataFromLocal();
  };

  const updateCatalogItem = (catalogId, itemData) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.updateCatalogItem(catalogId, itemData, actorName);
    refreshDataFromLocal();
  };

  const deleteCatalogItem = (catalogId) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.deleteCatalogItem(catalogId, actorName);
    refreshDataFromLocal();
  };

  const updateConsumableState = (consumableId, newState) => {
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.updateConsumableState(consumableId, newState, actorName);
    refreshDataFromLocal();
  };

  const toggleJobMode = () => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    setSyncStatus('syncing');
    const actorName = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Petr M.';
    storageService.toggleJobMode(currentJobId, actorName);
    refreshDataFromLocal();
  };

  const createJob = (jobData) => {
    if (!isAdmin()) {
      alert('Vytváření zakázek vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    setSyncStatus('syncing');
    const actorName = `${currentUser.name} (${currentUser.role})`;
    const newJob = storageService.createJob(jobData, actorName);
    refreshDataFromLocal();
    setCurrentJobId(newJob.id);
    setIsNewJobModalOpen(false);
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
