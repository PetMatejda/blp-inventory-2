import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { cloudSyncService } from '../services/cloudSyncService';
import { cloudBackend } from '../services/cloudBackend';
import { authService } from '../services/authService';

const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
  const [jobs, setJobs] = useState([]);
  const [currentJobId, setCurrentJobIdState] = useState('');
  const [jobItems, setJobItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [consumables, setConsumables] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [currentUser, setCurrentUserState] = useState(authService.getCurrentUser());
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [themeMode, setThemeMode] = useState('dark');

  // Cloud Sync state
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

  // Load state on mount & Auto Sync registration
  const refreshData = () => {
    storageService.init();
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
    refreshData();

    // Subscribe to multi-device real-time cloud updates
    const unsubscribeCloud = cloudBackend.subscribe(() => {
      refreshData();
    });

    const handleAuthChanged = (e) => {
      if (e.detail) {
        setCurrentUserState(e.detail);
        storageService.setUserRole(e.detail.role);
      }
    };

    window.addEventListener('blp_auth_changed', handleAuthChanged);

    const handleOnline = () => {
      setIsOffline(false);
      cloudSyncService.syncPendingChanges().then(res => {
        if (res.synced > 0) {
          setSyncNotice(`Synchronizováno ${res.synced} offline změn s cloudem.`);
          setTimeout(() => setSyncNotice(null), 3500);
        }
      });
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    cloudSyncService.initAutoSync((syncedCount) => {
      setSyncNotice(`Automaticky synchronizováno ${syncedCount} položek.`);
      setTimeout(() => setSyncNotice(null), 3500);
    });

    return () => {
      unsubscribeCloud();
      window.removeEventListener('blp_auth_changed', handleAuthChanged);
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
    authService.setCurrentUser(user);
    setCurrentUserState(user);
    storageService.setUserRole(user.role);
  };

  const isAdmin = () => currentUser?.role === 'ADMIN';
  const canEditPacking = () => true; // Both ADMIN and USER can work in Packing!

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
    const mode = currentJob?.mode || 'LOADING';
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.updateItemQuantity(itemId, delta, actorName, mode);
    cloudSyncService.enqueue('UPDATE_QTY', { itemId, delta, mode });
    setJobItems(storageService.getJobItems(currentJobId));
    setAuditLogs(storageService.getAuditLogs());
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
    const mode = currentJob?.mode || 'LOADING';
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.setItemLoadedOrPacked(itemId, actorName, mode);
    cloudSyncService.enqueue('SET_LOADED_PACKED', { itemId, mode });
    setJobItems(storageService.getJobItems(currentJobId));
    setAuditLogs(storageService.getAuditLogs());
  };

  const setItemPending = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    const mode = currentJob?.mode || 'LOADING';
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.setItemPending(itemId, actorName, mode);
    cloudSyncService.enqueue('SET_PENDING', { itemId, mode });
    setJobItems(storageService.getJobItems(currentJobId));
    setAuditLogs(storageService.getAuditLogs());
  };

  const toggleItemStatus = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    const mode = currentJob?.mode || 'LOADING';
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.toggleItemStatus(itemId, actorName, mode);
    cloudSyncService.enqueue('TOGGLE_STATUS', { itemId, mode });
    setJobItems(storageService.getJobItems(currentJobId));
    setAuditLogs(storageService.getAuditLogs());
  };

  const deleteJobItem = (itemId) => {
    if (currentJob?.status === 'ARCHIVED') return;
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.deleteJobItem(itemId, actorName);
    cloudSyncService.enqueue('DELETE_JOB_ITEM', { itemId });
    setJobItems(storageService.getJobItems(currentJobId));
    setAuditLogs(storageService.getAuditLogs());
  };

  const reportItemDamage = (itemId, severity, notes, photoUrl) => {
    if (currentJob?.status === 'ARCHIVED') return;
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.reportItemDamage(itemId, severity, notes, photoUrl, actorName);
    cloudSyncService.enqueue('REPORT_DAMAGE', { itemId, severity, notes });
    setJobItems(storageService.getJobItems(currentJobId));
    setAuditLogs(storageService.getAuditLogs());
    setDamageReportItem(null);
  };

  const addAdHocItem = (name, category, quantity) => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.addAdHocItem(currentJobId, name, category, 'v1', quantity, actorName);
    cloudSyncService.enqueue('ADD_ADHOC', { currentJobId, name, category, quantity });
    setJobItems(storageService.getJobItems(currentJobId));
    setAuditLogs(storageService.getAuditLogs());
    setIsAdHocModalOpen(false);
  };

  const addCatalogItemToJob = (catalogItem) => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.addCatalogItemToJob(currentJobId, catalogItem, 'v1', actorName);
    cloudSyncService.enqueue('ADD_CATALOG_TO_JOB', { currentJobId, catalogId: catalogItem.id });
    setJobItems(storageService.getJobItems(currentJobId));
    setAuditLogs(storageService.getAuditLogs());
  };

  // Job Status & Template Operations (Restricted to ADMIN)
  const finishJob = (jobId) => {
    if (!isAdmin()) {
      alert('Ukončení a archivace zakázky vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.finishJob(jobId, actorName);
    cloudSyncService.enqueue('FINISH_JOB', { jobId });
    setJobs(storageService.getJobs());
    setAuditLogs(storageService.getAuditLogs());
  };

  const reactivateJob = (jobId) => {
    if (!isAdmin()) {
      alert('Obnovení zakázky vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.reactivateJob(jobId, actorName);
    cloudSyncService.enqueue('REACTIVATE_JOB', { jobId });
    setJobs(storageService.getJobs());
    setAuditLogs(storageService.getAuditLogs());
  };

  const updateJob = (jobId, jobData) => {
    if (!isAdmin()) {
      alert('Úprava zakázky vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.updateJob(jobId, jobData, actorName);
    cloudSyncService.enqueue('UPDATE_JOB', { jobId, jobData });
    setJobs(storageService.getJobs());
    setAuditLogs(storageService.getAuditLogs());
    setEditingJob(null);
  };

  const duplicateJobAsTemplate = (sourceJobId, newJobData) => {
    if (!isAdmin()) {
      alert('Vytváření kopií zakázky vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    const actorName = `${currentUser.name} (${currentUser.role})`;
    const newJob = storageService.duplicateJobAsTemplate(sourceJobId, newJobData, actorName);
    cloudSyncService.enqueue('DUPLICATE_JOB_TEMPLATE', { sourceJobId, newJobData });
    setJobs(storageService.getJobs());
    setCurrentJobId(newJob.id);
    setAuditLogs(storageService.getAuditLogs());
    setTemplateJob(null);
  };

  // Master Catalog CRUD (Restricted to ADMIN)
  const createCatalogItem = (itemData) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.createCatalogItem(itemData, actorName);
    cloudSyncService.enqueue('CREATE_CATALOG_ITEM', { itemData });
    setCatalog(storageService.getCatalog());
    setAuditLogs(storageService.getAuditLogs());
  };

  const updateCatalogItem = (catalogId, itemData) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.updateCatalogItem(catalogId, itemData, actorName);
    cloudSyncService.enqueue('UPDATE_CATALOG_ITEM', { catalogId, itemData });
    setCatalog(storageService.getCatalog());
    setAuditLogs(storageService.getAuditLogs());
  };

  const deleteCatalogItem = (catalogId) => {
    if (!isAdmin()) {
      alert('Správa Master Katalogu vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.deleteCatalogItem(catalogId, actorName);
    cloudSyncService.enqueue('DELETE_CATALOG_ITEM', { catalogId });
    setCatalog(storageService.getCatalog());
    setAuditLogs(storageService.getAuditLogs());
  };

  const updateConsumableState = (consumableId, newState) => {
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.updateConsumableState(consumableId, newState, actorName);
    cloudSyncService.enqueue('UPDATE_CONSUMABLE', { consumableId, newState });
    setConsumables(storageService.getConsumables());
    setAuditLogs(storageService.getAuditLogs());
  };

  const toggleJobMode = () => {
    if (!currentJobId || currentJob?.status === 'ARCHIVED') return;
    const actorName = `${currentUser.name} (${currentUser.role})`;
    storageService.toggleJobMode(currentJobId, actorName);
    cloudSyncService.enqueue('TOGGLE_JOB_MODE', { currentJobId });
    setJobs(storageService.getJobs());
    setAuditLogs(storageService.getAuditLogs());
  };

  const createJob = (jobData) => {
    if (!isAdmin()) {
      alert('Vytváření zakázek vyžaduje oprávnění ADMIN (Lead Gaffer).');
      return;
    }
    const actorName = `${currentUser.name} (${currentUser.role})`;
    const newJob = storageService.createJob(jobData, actorName);
    cloudSyncService.enqueue('CREATE_JOB', { jobData });
    setJobs(storageService.getJobs());
    setCurrentJobId(newJob.id);
    setAuditLogs(storageService.getAuditLogs());
    setIsNewJobModalOpen(false);
  };

  const resetDemoData = () => {
    storageService.resetDemoData();
    refreshData();
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
