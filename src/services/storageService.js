import {
  INITIAL_JOBS,
  INITIAL_JOB_ITEMS,
  INITIAL_VEHICLES,
  INITIAL_CONSUMABLES,
  INITIAL_AUDIT_LOGS,
  INITIAL_CATALOG
} from '../mockData/initialData.js';
import { firebaseDb } from './firebaseDb.js';
import { matchKeysFor, stampKeys, indexTombstones, isItemTombstoned } from './tombstones.js';

const KEYS = {
  JOBS: 'blp_jobs_v2',
  JOB_ITEMS: 'blp_job_items_v2',
  VEHICLES: 'blp_vehicles_v2',
  CONSUMABLES: 'blp_consumables_v2',
  AUDIT_LOGS: 'blp_audit_logs_v2',
  CATALOG: 'blp_catalog_v2',
  CURRENT_JOB_ID: 'blp_current_job_id_v2',
  CURRENT_USER_ROLE: 'blp_user_role_v2',
  DELETED_JOB_ITEMS: 'blp_deleted_job_items_v2',
  DELETED_JOBS: 'blp_deleted_jobs_v2',
  DELETED_CATALOG: 'blp_deleted_catalog_v2',
};

// Fast debounce helper — 100ms window for high-frequency updates (e.g. quantity changes)
let syncTimeout = null;
// Guard: tracks whether we have local changes waiting to be pushed
let hasPendingPush = false;

export const storageService = {
  // Tombstone management — ensures deleted items/jobs are NEVER resurrected by other devices
  getDeletedJobItemIds() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.DELETED_JOB_ITEMS) || '[]');
    } catch {
      return [];
    }
  },

  addDeletedJobItemId(...identifiers) {
    const list = this.getDeletedJobItemIds();
    const set = new Set(list);
    identifiers.filter(Boolean).forEach(id => set.add(String(id)));
    localStorage.setItem(KEYS.DELETED_JOB_ITEMS, JSON.stringify([...set]));
  },

  removeDeletedJobItemIdentifier(...identifiers) {
    const list = this.getDeletedJobItemIds();
    const set = new Set(list);
    identifiers.filter(Boolean).forEach(id => set.delete(String(id)));
    localStorage.setItem(KEYS.DELETED_JOB_ITEMS, JSON.stringify([...set]));
  },

  getDeletedJobIds() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.DELETED_JOBS) || '[]');
    } catch {
      return [];
    }
  },

  addDeletedJobId(jobId) {
    if (!jobId) return;
    const list = this.getDeletedJobIds();
    const set = new Set(list);
    set.add(String(jobId));
    localStorage.setItem(KEYS.DELETED_JOBS, JSON.stringify([...set]));
  },

  getDeletedCatalogIds() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.DELETED_CATALOG) || '[]');
    } catch {
      return [];
    }
  },

  addDeletedCatalogId(catalogId) {
    if (!catalogId) return;
    const list = this.getDeletedCatalogIds();
    const set = new Set(list);
    set.add(String(catalogId));
    localStorage.setItem(KEYS.DELETED_CATALOG, JSON.stringify([...set]));
  },

  removeDeletedCatalogId(catalogId) {
    if (!catalogId) return;
    const list = this.getDeletedCatalogIds();
    const set = new Set(list);
    set.delete(String(catalogId));
    localStorage.setItem(KEYS.DELETED_CATALOG, JSON.stringify([...set]));
  },

  async pushCurrentState() {
    hasPendingPush = false;
    return await firebaseDb.pushPayload({
      jobs: this.getJobs(),
      jobItems: JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]'),
      catalog: this.getCatalog(),
      consumables: this.getConsumables(),
      auditLogs: this.getAuditLogs(),
      deletedJobItemIds: this.getDeletedJobItemIds(),
      deletedJobIds: this.getDeletedJobIds(),
      deletedCatalogIds: this.getDeletedCatalogIds(),
    });
  },

  syncToCloud() {
    hasPendingPush = true;
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      await this.pushCurrentState();
    }, 100);
  },

  /**
   * Immediate cloud push for critical actions (finishJob, reactivateJob, deleteJobItem, deleteJob, deleteCatalogItem).
   * Bypasses debounce timer so that switching tabs or phone sleep cannot kill the sync.
   */
  async syncToCloudImmediate() {
    hasPendingPush = false;
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
    return await this.pushCurrentState();
  },

  /**
   * Flush any pending debounced push immediately (used before pulling from cloud).
   * Ensures local changes are pushed before remote data overwrites them.
   */
  async flushPendingSync() {
    if (!hasPendingPush) return;
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
    await this.pushCurrentState();
    console.log('[StorageService] Flushed pending sync before pull');
  },

  isSyncInProgress() {
    return hasPendingPush || (firebaseDb.isPushInProgress && firebaseDb.isPushInProgress());
  },

  async syncToCloudManual() {
    return await this.syncToCloudImmediate();
  },

  async syncFromCloudManual() {
    await this.flushPendingSync();
    return await firebaseDb.pullFromCloud();
  },

  consolidateItems(items) {
    const tombstones = indexTombstones(this.getDeletedJobItemIds());
    const deletedJobs = new Set(this.getDeletedJobIds());
    const map = new Map();
    const consolidated = [];

    for (const item of items) {
      if (!item || !item.name) continue;
      // Discard any items that belong to deleted jobs or are deleted
      if (isItemTombstoned(item, tombstones, deletedJobs)) continue;

      const groupKey = item.catalogId
        ? `${item.jobId}_cat_${item.catalogId}_${item.name.toLowerCase().trim()}`
        : `${item.jobId}_name_${item.name.toLowerCase().trim()}`;

      if (map.has(groupKey)) {
        const existing = map.get(groupKey);
        existing.quantityRequested += item.quantityRequested;
        existing.quantityLoaded += item.quantityLoaded;

        if (item.serialNumber && !(existing.serialNumber || '').includes(item.serialNumber)) {
          existing.serialNumber = existing.serialNumber
            ? `${existing.serialNumber}, ${item.serialNumber}`
            : item.serialNumber;
        }

        if (item.updatedAt && (!existing.updatedAt || new Date(item.updatedAt) > new Date(existing.updatedAt))) {
          existing.updatedAt = item.updatedAt;
          existing.status = item.status;
        }

        if (existing.quantityLoaded >= existing.quantityRequested && existing.quantityRequested > 0) {
          existing.status = existing.status === 'PACKED' ? 'PACKED' : 'LOADED';
        } else if (existing.quantityLoaded < existing.quantityRequested && existing.status !== 'DAMAGED') {
          existing.status = 'PENDING';
        }
      } else {
        const copy = { ...item };
        map.set(groupKey, copy);
        consolidated.push(copy);
      }
    }

    return consolidated;
  },

  init() {
    // Local fallback data initialization & clean migration to v5
    if (!localStorage.getItem('blp_data_version_v5')) {
      const migratedJobs = INITIAL_JOBS.map(j => ({
        ...j,
        riggingDate: j.riggingDate || j.date || new Date().toISOString().split('T')[0],
        deriggingDate: j.deriggingDate || j.date || new Date().toISOString().split('T')[0],
      }));
      localStorage.setItem(KEYS.JOBS, JSON.stringify(migratedJobs));
      const consolidatedInitial = this.consolidateItems(INITIAL_JOB_ITEMS);
      localStorage.setItem(KEYS.JOB_ITEMS, JSON.stringify(consolidatedInitial));
      localStorage.setItem(KEYS.VEHICLES, JSON.stringify(INITIAL_VEHICLES));
      localStorage.setItem(KEYS.CONSUMABLES, JSON.stringify(INITIAL_CONSUMABLES));
      localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
      localStorage.setItem(KEYS.CATALOG, JSON.stringify(INITIAL_CATALOG));
      localStorage.setItem(KEYS.CURRENT_JOB_ID, 'job-101');
      localStorage.setItem(KEYS.CURRENT_USER_ROLE, 'Lead Gaffer');
      localStorage.setItem('blp_data_version_v5', '5.0');
      return;
    }



    if (!localStorage.getItem(KEYS.JOBS)) {
      const migratedJobs = INITIAL_JOBS.map(j => ({
        ...j,
        riggingDate: j.riggingDate || j.date || new Date().toISOString().split('T')[0],
        deriggingDate: j.deriggingDate || j.date || new Date().toISOString().split('T')[0],
      }));
      localStorage.setItem(KEYS.JOBS, JSON.stringify(migratedJobs));
    }
    if (!localStorage.getItem(KEYS.JOB_ITEMS)) {
      const consolidatedInitial = this.consolidateItems(INITIAL_JOB_ITEMS);
      localStorage.setItem(KEYS.JOB_ITEMS, JSON.stringify(consolidatedInitial));
    }
    if (!localStorage.getItem(KEYS.VEHICLES)) {
      localStorage.setItem(KEYS.VEHICLES, JSON.stringify(INITIAL_VEHICLES));
    }
    if (!localStorage.getItem(KEYS.CONSUMABLES)) {
      localStorage.setItem(KEYS.CONSUMABLES, JSON.stringify(INITIAL_CONSUMABLES));
    }
    if (!localStorage.getItem(KEYS.AUDIT_LOGS)) {
      localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
    }
    if (!localStorage.getItem(KEYS.CATALOG)) {
      localStorage.setItem(KEYS.CATALOG, JSON.stringify(INITIAL_CATALOG));
    }
    if (!localStorage.getItem(KEYS.CURRENT_JOB_ID)) {
      localStorage.setItem(KEYS.CURRENT_JOB_ID, 'job-101');
    }
    if (!localStorage.getItem(KEYS.CURRENT_USER_ROLE)) {
      localStorage.setItem(KEYS.CURRENT_USER_ROLE, 'Lead Gaffer');
    }

    const rawItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const cleanItems = this.consolidateItems(rawItems);
    localStorage.setItem(KEYS.JOB_ITEMS, JSON.stringify(cleanItems));
  },


  resetDemoData() {
    const migratedJobs = INITIAL_JOBS.map(j => ({
      ...j,
      riggingDate: j.riggingDate || '2026-08-24',
      deriggingDate: j.deriggingDate || '2026-08-25',
    }));
    localStorage.setItem(KEYS.JOBS, JSON.stringify(migratedJobs));
    const consolidatedInitial = this.consolidateItems(INITIAL_JOB_ITEMS);
    localStorage.setItem(KEYS.JOB_ITEMS, JSON.stringify(consolidatedInitial));
    localStorage.setItem(KEYS.VEHICLES, JSON.stringify(INITIAL_VEHICLES));
    localStorage.setItem(KEYS.CONSUMABLES, JSON.stringify(INITIAL_CONSUMABLES));
    localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
    localStorage.setItem(KEYS.CATALOG, JSON.stringify(INITIAL_CATALOG));
    localStorage.setItem(KEYS.CURRENT_JOB_ID, 'job-101');
    localStorage.setItem(KEYS.CURRENT_USER_ROLE, 'Lead Gaffer');
    this.syncToCloud();
  },

  getJobs() {
    try {
      const jobs = JSON.parse(localStorage.getItem(KEYS.JOBS) || '[]');
      const deletedJobIds = new Set(this.getDeletedJobIds());
      return jobs.filter(j => !deletedJobIds.has(j.id));
    } catch {
      return [];
    }
  },

  getJobItems(jobId) {
    const items = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const consolidated = this.consolidateItems(items);
    return jobId ? consolidated.filter(item => item.jobId === jobId) : consolidated;
  },

  getVehicles() {
    return JSON.parse(localStorage.getItem(KEYS.VEHICLES) || '[]');
  },

  getConsumables() {
    return JSON.parse(localStorage.getItem(KEYS.CONSUMABLES) || '[]');
  },

  getAuditLogs() {
    return JSON.parse(localStorage.getItem(KEYS.AUDIT_LOGS) || '[]');
  },

  getCatalog() {
    try {
      const catalog = JSON.parse(localStorage.getItem(KEYS.CATALOG) || '[]');
      const deletedCatalogIds = new Set(this.getDeletedCatalogIds());
      return catalog.filter(c => !deletedCatalogIds.has(c.id));
    } catch {
      return [];
    }
  },

  getCurrentJobId() {
    return localStorage.getItem(KEYS.CURRENT_JOB_ID) || 'job-101';
  },

  setCurrentJobId(jobId) {
    localStorage.setItem(KEYS.CURRENT_JOB_ID, jobId);
  },

  getUserRole() {
    return localStorage.getItem(KEYS.CURRENT_USER_ROLE) || 'Lead Gaffer';
  },

  setUserRole(role) {
    localStorage.setItem(KEYS.CURRENT_USER_ROLE, role);
  },

  saveJobs(jobs) {
    localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
    this.syncToCloud();
  },

  saveJobItems(allJobItems) {
    const consolidated = this.consolidateItems(allJobItems);
    localStorage.setItem(KEYS.JOB_ITEMS, JSON.stringify(consolidated));
    this.syncToCloud();
  },

  saveCatalog(catalog) {
    localStorage.setItem(KEYS.CATALOG, JSON.stringify(catalog));
    this.syncToCloud();
  },

  addAuditLog(user, jobId, action, detail, type = 'update') {
    const logs = this.getAuditLogs();
    const newLog = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      user: user || 'Petr M. (Lead Gaffer)',
      jobId: jobId || '',
      action,
      detail,
      type,
    };
    logs.unshift(newLog);
    localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(logs));
    return newLog;
  },

  finishJob(jobId, user) {
    const jobs = this.getJobs();
    const index = jobs.findIndex(j => j.id === jobId);
    if (index === -1) return null;

    const now = new Date().toISOString();
    jobs[index].status = 'ARCHIVED';
    jobs[index].updatedAt = now;
    this.addAuditLog(user, jobId, 'Ukončení zakázky', `Zakázka ${jobs[index].name} byla dokončena a uzamčena do archivu.`, 'update');
    localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
    this.syncToCloudImmediate();

    return jobs[index];
  },

  reactivateJob(jobId, user) {
    const jobs = this.getJobs();
    const index = jobs.findIndex(j => j.id === jobId);
    if (index === -1) return null;

    const now = new Date().toISOString();
    jobs[index].status = 'ACTIVE';
    jobs[index].updatedAt = now;
    this.addAuditLog(user, jobId, 'Obnovení zakázky', `Zakázka ${jobs[index].name} byla vrácena zpět do aktivního stavu.`, 'update');
    localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
    this.syncToCloudImmediate();

    return jobs[index];
  },

  createJob(jobData, user) {
    const jobs = this.getJobs();
    const now = new Date().toISOString();
    const newJob = {
      id: 'job-' + Date.now(),
      name: jobData.name,
      client: jobData.client || '',
      assignedGaffer: jobData.assignedGaffer || 'Petr M.',
      blpResponsible: jobData.blpResponsible || 'Marek Radolf',
      riggingDate: jobData.riggingDate || now.split('T')[0],
      deriggingDate: jobData.deriggingDate || now.split('T')[0],
      vehicleIds: jobData.vehicleIds || ['v1'],
      status: 'ACTIVE',
      mode: 'LOADING',
      updatedAt: now,
    };

    jobs.unshift(newJob);
    this.addAuditLog(user, newJob.id, 'Nová zakázka', `Vytvořena zakázka: ${newJob.name} (BLP: ${newJob.blpResponsible}, Gaffer: ${newJob.assignedGaffer})`, 'add');
    localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
    this.setCurrentJobId(newJob.id);
    this.syncToCloudImmediate();

    return newJob;
  },

  updateJob(jobId, jobData, user) {
    const jobs = this.getJobs();
    const index = jobs.findIndex(j => j.id === jobId);
    if (index === -1) return null;

    jobs[index] = { ...jobs[index], ...jobData, updatedAt: new Date().toISOString() };
    this.addAuditLog(user, jobId, 'Úprava zakázky', `Upraveny údaje zakázky ${jobs[index].name} (BLP: ${jobs[index].blpResponsible || 'BLP Tým'}, Gaffer: ${jobs[index].assignedGaffer})`, 'update');
    localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
    this.syncToCloudImmediate();

    return jobs[index];
  },

  deleteJob(jobId, user) {
    const jobs = this.getJobs();
    const targetJob = jobs.find(j => j.id === jobId);
    const updatedJobs = jobs.filter(j => j.id !== jobId);
    this.addDeletedJobId(jobId);
    localStorage.setItem(KEYS.JOBS, JSON.stringify(updatedJobs));

    // Remove all associated items for this job & mark them in tombstones
    const allJobItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const itemsToDelete = allJobItems.filter(i => i.jobId === jobId);
    itemsToDelete.forEach(i => {
      this.addDeletedJobItemId(i.id, ...stampKeys(matchKeysFor(i)));
    });
    const remainingItems = allJobItems.filter(i => i.jobId !== jobId);
    localStorage.setItem(KEYS.JOB_ITEMS, JSON.stringify(remainingItems));

    this.addAuditLog(user, jobId, 'Smazána zakázka', `Zakázka ${targetJob?.name || jobId} byla trvale smazána včetně položek`, 'delete');

    if (this.getCurrentJobId() === jobId) {
      this.setCurrentJobId(updatedJobs[0]?.id || null);
    }

    this.syncToCloudImmediate();
    return true;
  },

  duplicateJobAsTemplate(sourceJobId, newJobData, user) {
    const jobs = this.getJobs();
    const sourceJob = jobs.find(j => j.id === sourceJobId);
    if (!sourceJob) return null;

    const newJob = {
      id: 'job-' + Date.now(),
      name: newJobData.name || `${sourceJob.name} (Kopie)`,
      client: newJobData.client || sourceJob.client,
      assignedGaffer: newJobData.assignedGaffer || sourceJob.assignedGaffer,
      blpResponsible: newJobData.blpResponsible || sourceJob.blpResponsible || 'Marek Radolf',
      riggingDate: newJobData.riggingDate || new Date().toISOString().split('T')[0],
      deriggingDate: newJobData.deriggingDate || new Date().toISOString().split('T')[0],
      vehicleIds: sourceJob.vehicleIds || ['v1'],
      status: 'ACTIVE',
      mode: 'LOADING',
      updatedAt: new Date().toISOString(),
    };


    jobs.unshift(newJob);

    const sourceItems = this.getJobItems(sourceJobId);
    const allJobItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');

    sourceItems.forEach((item, idx) => {
      const copiedItem = {
        ...item,
        id: `ji-copy-${Date.now()}-${idx}`,
        jobId: newJob.id,
        quantityLoaded: 0,
        status: 'PENDING',
        damageNotes: '',
        damageSeverity: null,
        photoUrls: [],
        updatedAt: newJob.updatedAt,
      };
      allJobItems.push(copiedItem);
    });

    this.addAuditLog(
      user,
      newJob.id,
      'Kopie zakázky ze vzoru',
      `Vytvořena nová zakázka ${newJob.name} na základě vzoru ${sourceJob.name} (${sourceItems.length} zkopírovaných položek)`,
      'add'
    );

    this.saveJobs(jobs);
    this.saveJobItems(allJobItems);
    this.setCurrentJobId(newJob.id);

    return newJob;
  },

  createCatalogItem(itemData, user) {
    const catalog = this.getCatalog();
    const newItem = {
      id: 'cat-' + Date.now(),
      name: itemData.name,
      category: itemData.category || 'Lights',
      weight: itemData.weight || '',
      power: itemData.power || '',
      image: itemData.image || '',
      serialPrefix: itemData.serialPrefix || 'EQP',
      barcode: itemData.barcode || '',
      availableCount: parseInt(itemData.availableCount) || 10,
      isBundle: !!itemData.isBundle,
      bundleItems: itemData.bundleItems || [],
    };


    catalog.unshift(newItem);
    this.addAuditLog(user, '', 'Katalog Přidání', `Vytvořena nová položka v katalogu: ${newItem.name}`, 'add');
    this.saveCatalog(catalog);

    return newItem;
  },

  updateCatalogItem(catalogId, itemData, user) {
    const catalog = this.getCatalog();
    const index = catalog.findIndex(c => c.id === catalogId);
    if (index === -1) return null;

    const oldName = catalog[index].name;
    catalog[index] = { ...catalog[index], ...itemData };
    const newName = catalog[index].name;

    const logDetail = oldName !== newName
      ? `Přejmenována položka katalogu: „${oldName}“ → „${newName}“`
      : `Upravena položka katalogu: ${newName}`;

    this.addAuditLog(user, '', 'Katalog Úprava', logDetail, 'update');
    this.saveCatalog(catalog);

    // Pokud došlo k přejmenování nebo změně parametrů, synchronizovat i existující položky v zakázkách
    if (itemData.name && itemData.name !== oldName) {
      const allJobItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
      let hasJobItemUpdates = false;
      const updatedJobItems = allJobItems.map(item => {
        if (item.catalogId === catalogId) {
          hasJobItemUpdates = true;
          return {
            ...item,
            name: itemData.name,
            category: itemData.category || item.category,
            photoUrls: itemData.image ? [itemData.image] : item.photoUrls,
          };
        }
        return item;
      });

      if (hasJobItemUpdates) {
        this.saveJobItems(updatedJobItems);
      }
    }

    return catalog[index];
  },

  deleteCatalogItem(catalogId, user) {
    const catalog = this.getCatalog();
    const itemToDelete = catalog.find(c => c.id === catalogId);
    if (!itemToDelete) return null;

    const filtered = catalog.filter(c => c.id !== catalogId);
    this.addDeletedCatalogId(catalogId);
    this.addAuditLog(user, '', 'Katalog Mazání', `Smazána položka z katalogu: ${itemToDelete.name}`, 'update');
    localStorage.setItem(KEYS.CATALOG, JSON.stringify(filtered));
    this.syncToCloudImmediate();

    return itemToDelete;
  },

  deleteJobItem(itemId, user, jobItemData = null) {
    const allItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    let itemToDelete = allItems.find(i => i.id === itemId);

    // Fallback pokud položka nebyla nalezena pouze podle ID (např. desync z cloudu)
    if (!itemToDelete && jobItemData) {
      itemToDelete = allItems.find(i =>
        i.jobId === jobItemData.jobId &&
        ((jobItemData.catalogId && i.catalogId === jobItemData.catalogId) ||
         i.name.toLowerCase().trim() === (jobItemData.name || '').toLowerCase().trim())
      );
    }

    if (!itemToDelete && !jobItemData) return null;

    const targetJobId = itemToDelete?.jobId || jobItemData?.jobId;
    const targetCatalogId = itemToDelete?.catalogId || jobItemData?.catalogId;
    const targetName = (itemToDelete?.name || jobItemData?.name || '').toLowerCase().trim();
    const itemNameForLog = itemToDelete?.name || jobItemData?.name || 'Položka';
    const itemQtyForLog = itemToDelete?.quantityRequested || jobItemData?.quantityRequested || 1;

    // Record tombstones so no other client can bring this item back.
    // IDs are permanent; name/catalog matches are time-stamped so the same
    // equipment can be added to the job again later (see tombstones.js).
    this.addDeletedJobItemId(
      itemId,
      itemToDelete?.id,
      jobItemData?.id,
      ...stampKeys(matchKeysFor({ jobId: targetJobId, catalogId: targetCatalogId, name: itemNameForLog }))
    );

    // Smazat VŠECHNY záznamy odpovídající této položce v dané zakázce
    // (tím se zabrání znovuoživení položky, pokud byla složena z duplicitních či dílčích záznamů)
    const filtered = allItems.filter(i => {
      if (i.id === itemId) return false;
      if (itemToDelete?.id && i.id === itemToDelete.id) return false;
      if (jobItemData?.id && i.id === jobItemData.id) return false;
      if (targetJobId && i.jobId === targetJobId) {
        if (targetCatalogId && i.catalogId === targetCatalogId) return false;
        if (targetName && i.name.toLowerCase().trim() === targetName) return false;
      }
      return true;
    });

    this.addAuditLog(
      user,
      targetJobId || '',
      'Odebrání položky',
      `${itemNameForLog} (${itemQtyForLog} ks) odebrán ze zakázky`,
      'update'
    );

    const consolidated = this.consolidateItems(filtered);
    localStorage.setItem(KEYS.JOB_ITEMS, JSON.stringify(consolidated));
    this.syncToCloudImmediate();

    return itemToDelete || jobItemData;
  },

  updateItemQuantity(itemId, delta, user, mode = 'LOADING') {
    const allItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const index = allItems.findIndex(i => i.id === itemId);
    if (index === -1) return null;

    const item = { ...allItems[index] };
    const prevQty = item.quantityLoaded;
    let reqQty = item.quantityRequested;

    let newQty = Math.max(0, prevQty + delta);

    if (newQty > reqQty) {
      reqQty = newQty;
      item.quantityRequested = reqQty;
    }

    item.quantityLoaded = newQty;
    item.updatedAt = new Date().toISOString();
    let oldStatus = item.status;

    if (mode === 'DERIGGING') {
      if (newQty === reqQty && newQty > 0) {
        item.status = 'PACKED';
      } else if (newQty < reqQty) {
        item.status = 'PENDING';
      }
    } else {
      if (newQty === reqQty && newQty > 0) {
        item.status = 'LOADED';
      } else if (newQty < reqQty) {
        item.status = 'PENDING';
      }
    }

    allItems[index] = item;

    const statusText = mode === 'DERIGGING' ? 'PACKED' : item.status;
    this.addAuditLog(
      user,
      item.jobId,
      delta > 0 ? (newQty > prevQty ? 'Přičtení kusů (Navýšení)' : 'Přičtení kusů') : 'Odečtení kusů',
      `${item.name}: ${newQty}/${reqQty} ks, stav ${oldStatus} -> ${statusText}`,
      'loaded'
    );
    this.saveJobItems(allItems);

    return item;
  },

  setItemLoadedOrPacked(itemId, user, mode = 'LOADING') {
    const allItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const index = allItems.findIndex(i => i.id === itemId);
    if (index === -1) return null;

    const item = { ...allItems[index] };
    item.quantityLoaded = item.quantityRequested;
    item.status = mode === 'DERIGGING' ? 'PACKED' : 'LOADED';
    item.updatedAt = new Date().toISOString();

    allItems[index] = item;

    this.addAuditLog(
      user,
      item.jobId,
      mode === 'DERIGGING' ? 'Swipe Sbaleno' : 'Swipe Naloženo',
      `${item.name} naložen/sbalen v plném počtu (${item.quantityLoaded}/${item.quantityRequested} ks)`,
      'loaded'
    );
    this.saveJobItems(allItems);

    return item;
  },

  setItemPending(itemId, user, mode = 'LOADING') {
    const allItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const index = allItems.findIndex(i => i.id === itemId);
    if (index === -1) return null;

    const item = { ...allItems[index] };

    if (mode === 'DERIGGING') {
      item.quantityLoaded = item.quantityRequested;
      item.status = 'LOADED';
    } else {
      item.quantityLoaded = 0;
      item.status = 'PENDING';
    }
    item.updatedAt = new Date().toISOString();

    allItems[index] = item;

    this.addAuditLog(
      user,
      item.jobId,
      mode === 'DERIGGING' ? 'Swipe Vráceno na place' : 'Swipe K naložení',
      mode === 'DERIGGING'
        ? `${item.name} zrušeno sbalení, stav vrácen na Na place (${item.quantityLoaded}/${item.quantityRequested} ks)`
        : `${item.name} zrušena nakládka, stav vrácen na K naložení (0/${item.quantityRequested} ks)`,
      'loaded'
    );
    this.saveJobItems(allItems);

    return item;
  },

  toggleItemStatus(itemId, user, mode = 'LOADING') {
    const allItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const index = allItems.findIndex(i => i.id === itemId);
    if (index === -1) return null;

    const item = { ...allItems[index] };
    let newStatus = 'PENDING';

    if (item.status === 'LOADED' || item.status === 'PACKED') {
      newStatus = 'PENDING';
      item.quantityLoaded = 0;
    } else if (item.status === 'PENDING') {
      item.quantityLoaded = item.quantityRequested;
      newStatus = mode === 'DERIGGING' ? 'PACKED' : 'LOADED';
    } else if (item.status === 'DAMAGED') {
      // Clear damage (spec 4.2 rule 4): keep the counted quantity; the item is
      // done only if the full quantity is present, otherwise back to PENDING.
      const isComplete = item.quantityRequested > 0 && item.quantityLoaded >= item.quantityRequested;
      newStatus = isComplete ? (mode === 'DERIGGING' ? 'PACKED' : 'LOADED') : 'PENDING';
      item.damageNotes = '';
      item.damageSeverity = null;
      item.photoUrls = [];
    }

    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
    allItems[index] = item;

    this.addAuditLog(
      user,
      item.jobId,
      'Změna stavu',
      `${item.name} Přepnuto na ${newStatus} (${item.quantityLoaded}/${item.quantityRequested} ks)`,
      newStatus === 'DAMAGED' ? 'damage' : 'loaded'
    );
    this.saveJobItems(allItems);

    return item;
  },

  reportItemDamage(itemId, severity, notes, photoUrl, user) {
    const allItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const index = allItems.findIndex(i => i.id === itemId);
    if (index === -1) return null;

    const item = { ...allItems[index] };
    item.status = 'DAMAGED';
    item.damageSeverity = severity;
    item.damageNotes = notes;
    item.updatedAt = new Date().toISOString();
    if (photoUrl) {
      item.photoUrls = [...(item.photoUrls || []), photoUrl];
    }

    allItems[index] = item;

    this.addAuditLog(
      user,
      item.jobId,
      'Hlášení poškození',
      `${item.name} označen jako ${severity} DAMAGED. Poznamka: ${notes}`,
      'damage'
    );
    this.saveJobItems(allItems);

    return item;
  },

  addAdHocItem(jobId, name, category, vehicleId, quantity, user) {
    const allItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const formattedName = `${name} (Ad-Hoc)`;

    const existingIndex = allItems.findIndex(
      i => i.jobId === jobId && i.name.toLowerCase().trim() === formattedName.toLowerCase().trim()
    );

    const nowIso = new Date().toISOString();
    this.removeDeletedJobItemIdentifier(`${jobId}_${formattedName}`);

    if (existingIndex !== -1) {
      allItems[existingIndex].quantityRequested += parseInt(quantity) || 1;
      allItems[existingIndex].updatedAt = nowIso;
      this.removeDeletedJobItemIdentifier(allItems[existingIndex].id);
      this.addAuditLog(
        user,
        jobId,
        'Navýšení kusů Ad-Hoc',
        `${allItems[existingIndex].name} navýšen požadavek na ${allItems[existingIndex].quantityRequested} ks`,
        'add'
      );
      this.saveJobItems(allItems);
      this.syncToCloudImmediate();
      return allItems[existingIndex];
    }

    const newItem = {
      id: 'adhoc-' + Date.now(),
      jobId,
      catalogId: null,
      name: formattedName,
      category: category || 'Grip',
      assignedVehicleId: vehicleId || 'v1',
      quantityRequested: parseInt(quantity) || 1,
      quantityLoaded: 0,
      status: 'PENDING',
      serialNumber: 'ADHOC-' + Math.floor(1000 + Math.random() * 9000),
      isAdHoc: true,
      damageNotes: '',
      photoUrls: [],
      updatedAt: nowIso,
    };

    this.removeDeletedJobItemIdentifier(newItem.id);
    allItems.push(newItem);
    this.addAuditLog(
      user,
      jobId,
      'Přidána Ad-Hoc položka',
      `Vloženo nestandardní zařízení: ${newItem.name} (${newItem.quantityRequested} ks)`,
      'add'
    );
    this.saveJobItems(allItems);
    this.syncToCloudImmediate();

    return newItem;
  },

  addCatalogItemToJob(jobId, catalogItem, vehicleId, user) {
    const allItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const catalogList = this.getCatalog();
    const nowIso = new Date().toISOString();

    if (catalogItem.isBundle && catalogItem.bundleItems && catalogItem.bundleItems.length > 0) {
      const addedSummary = [];

      catalogItem.bundleItems.forEach((sub, idx) => {
        const subName = sub.name;
        const subQty = sub.qty || 1;

        this.removeDeletedJobItemIdentifier(`${jobId}_${subName}`);

        const existingIdx = allItems.findIndex(
          i => i.jobId === jobId && i.name.toLowerCase().trim() === subName.toLowerCase().trim()
        );

        if (existingIdx !== -1) {
          allItems[existingIdx].quantityRequested += subQty;
          allItems[existingIdx].updatedAt = nowIso;
          this.removeDeletedJobItemIdentifier(allItems[existingIdx].id);
          addedSummary.push(`${subName} (+${subQty} ks)`);
        } else {
          const catalogMatch = catalogList.find(c => c.name.toLowerCase().trim() === subName.toLowerCase().trim());
          const subId = `ji-sub-${Date.now()}-${idx}`;
          this.removeDeletedJobItemIdentifier(subId);

          const subItem = {
            id: subId,
            jobId,
            catalogId: catalogMatch ? catalogMatch.id : null,
            name: subName,
            category: catalogMatch ? catalogMatch.category : (catalogItem.category || 'Lights'),
            assignedVehicleId: vehicleId || 'v1',
            quantityRequested: subQty,
            quantityLoaded: 0,
            status: 'PENDING',
            serialNumber: catalogMatch ? `${catalogMatch.serialPrefix}-${Math.floor(100 + Math.random() * 900)}` : `SET-${Math.floor(100 + Math.random() * 900)}`,
            bundleTag: `Doporučeno ze setu: ${catalogItem.name}`,
            isAdHoc: false,
            isBundle: false,
            damageNotes: '',
            photoUrls: catalogMatch?.image ? [catalogMatch.image] : [catalogItem.image],
            updatedAt: nowIso,
          };
          allItems.push(subItem);
          addedSummary.push(`${subName} (${subQty} ks)`);
        }
      });

      this.addAuditLog(
        user,
        jobId,
        'Vložení dílů ze Setu',
        `Ze setu ${catalogItem.name} vloženy samostatné položky: ${addedSummary.join(', ')}`,
        'add'
      );
      this.saveJobItems(allItems);
      this.syncToCloudImmediate();
    } else {
      this.removeDeletedJobItemIdentifier(`${jobId}_${catalogItem.name}`);

      const existingIdx = allItems.findIndex(
        i => i.jobId === jobId && (i.catalogId === catalogItem.id || i.name.toLowerCase().trim() === catalogItem.name.toLowerCase().trim())
      );

      if (existingIdx !== -1) {
        allItems[existingIdx].quantityRequested += 1;
        allItems[existingIdx].updatedAt = nowIso;
        this.removeDeletedJobItemIdentifier(allItems[existingIdx].id);
        this.addAuditLog(
          user,
          jobId,
          'Navýšení počtu z katalogu',
          `${catalogItem.name} navýšen počet požadovaných kusů na ${allItems[existingIdx].quantityRequested} ks`,
          'add'
        );
        this.saveJobItems(allItems);
        this.syncToCloudImmediate();
      } else {
        const itemId = `ji-cat-${Date.now()}`;
        this.removeDeletedJobItemIdentifier(itemId);
        const newItem = {
          id: itemId,
          jobId,
          catalogId: catalogItem.id,
          name: catalogItem.name,
          category: catalogItem.category,
          assignedVehicleId: vehicleId || 'v1',
          quantityRequested: 1,
          quantityLoaded: 0,
          status: 'PENDING',
          serialNumber: `${catalogItem.serialPrefix}-${Math.floor(100 + Math.random() * 900)}`,
          barcode: catalogItem.barcode || '',
          isAdHoc: false,
          isBundle: false,
          damageNotes: '',
          photoUrls: catalogItem.image ? [catalogItem.image] : [],
          updatedAt: nowIso,
        };
        allItems.push(newItem);
        this.addAuditLog(
          user,
          jobId,
          'Přidáno z katalogu',
          `${catalogItem.name} vloženo do zakázky (1 ks)`,
          'add'
        );
        this.saveJobItems(allItems);
        this.syncToCloudImmediate();
      }
    }
  },

  updateConsumableState(consumableId, newState, user) {
    const consumables = this.getConsumables();
    const index = consumables.findIndex(c => c.id === consumableId);
    if (index === -1) return null;

    const labels = ['OK', '50%', 'REFILL'];
    consumables[index].state = newState;
    consumables[index].stateLabel = labels[newState] || 'OK';

    localStorage.setItem(KEYS.CONSUMABLES, JSON.stringify(consumables));

    this.addAuditLog(
      user,
      '',
      'Brácha Změna',
      `${consumables[index].name} stav změněn na ${labels[newState]}`,
      'bracha'
    );
    this.syncToCloud();

    return consumables[index];
  },

  toggleJobMode(jobId, user) {
    const jobs = this.getJobs();
    const index = jobs.findIndex(j => j.id === jobId);
    if (index === -1) return null;

    const currentMode = jobs[index].mode || 'LOADING';
    const newMode = currentMode === 'LOADING' ? 'DERIGGING' : 'LOADING';
    jobs[index].mode = newMode;
    // Bump updatedAt so other devices accept the new mode when merging.
    jobs[index].updatedAt = new Date().toISOString();

    this.addAuditLog(
      user,
      jobId,
      'Přepnutí režimu zakázky',
      `Režim zakázky přepnut na: ${newMode === 'DERIGGING' ? 'DERIGGING (Vracení z placu)' : 'RIGGING (Ze skladu na plac)'}`,
      'update'
    );
    this.saveJobs(jobs);

    return jobs[index];
  }
};
