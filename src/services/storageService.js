import {
  INITIAL_JOBS,
  INITIAL_JOB_ITEMS,
  INITIAL_VEHICLES,
  INITIAL_CONSUMABLES,
  INITIAL_AUDIT_LOGS,
  INITIAL_CATALOG
} from '../mockData/initialData';
import { firebaseDb } from './firebaseDb';

const KEYS = {
  JOBS: 'blp_jobs_v2',
  JOB_ITEMS: 'blp_job_items_v2',
  VEHICLES: 'blp_vehicles_v2',
  CONSUMABLES: 'blp_consumables_v2',
  AUDIT_LOGS: 'blp_audit_logs_v2',
  CATALOG: 'blp_catalog_v2',
  CURRENT_JOB_ID: 'blp_current_job_id_v2',
  CURRENT_USER_ROLE: 'blp_user_role_v2',
};

// Debounce helper to prevent rapid double cloud pushes
let syncTimeout = null;

export const storageService = {
  syncToCloud() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      firebaseDb.pushPayload({
        jobs: this.getJobs(),
        jobItems: JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]'),
        catalog: this.getCatalog(),
        consumables: this.getConsumables(),
        auditLogs: this.getAuditLogs(),
      });
    }, 150);
  },

  async syncToCloudManual() {
    return await firebaseDb.pushPayload({
      jobs: this.getJobs(),
      jobItems: JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]'),
      catalog: this.getCatalog(),
      consumables: this.getConsumables(),
      auditLogs: this.getAuditLogs(),
    });
  },

  consolidateItems(items) {
    const map = new Map();
    const consolidated = [];

    for (const item of items) {
      const groupKey = item.catalogId
        ? `${item.jobId}_cat_${item.catalogId}_${item.name.toLowerCase().trim()}`
        : `${item.jobId}_name_${item.name.toLowerCase().trim()}`;

      if (map.has(groupKey)) {
        const existing = map.get(groupKey);
        existing.quantityRequested += item.quantityRequested;
        existing.quantityLoaded += item.quantityLoaded;

        if (item.serialNumber && !existing.serialNumber.includes(item.serialNumber)) {
          existing.serialNumber = `${existing.serialNumber}, ${item.serialNumber}`;
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

    this.syncToCloud();
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
    return JSON.parse(localStorage.getItem(KEYS.JOBS) || '[]');
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
    return JSON.parse(localStorage.getItem(KEYS.CATALOG) || '[]');
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

    jobs[index].status = 'ARCHIVED';
    this.addAuditLog(user, jobId, 'Ukončení zakázky', `Zakázka ${jobs[index].name} byla dokončena a uzamčena do archivu.`, 'update');
    this.saveJobs(jobs);

    return jobs[index];
  },

  reactivateJob(jobId, user) {
    const jobs = this.getJobs();
    const index = jobs.findIndex(j => j.id === jobId);
    if (index === -1) return null;

    jobs[index].status = 'ACTIVE';
    this.addAuditLog(user, jobId, 'Obnovení zakázky', `Zakázka ${jobs[index].name} byla vrátila zpět do aktivního stavu.`, 'update');
    this.saveJobs(jobs);

    return jobs[index];
  },

  updateJob(jobId, jobData, user) {
    const jobs = this.getJobs();
    const index = jobs.findIndex(j => j.id === jobId);
    if (index === -1) return null;

    jobs[index] = { ...jobs[index], ...jobData };
    this.addAuditLog(user, jobId, 'Úprava zakázky', `Upraveny údaje zakázky ${jobs[index].name} (Rigging: ${jobData.riggingDate}, Derigging: ${jobData.deriggingDate})`, 'update');
    this.saveJobs(jobs);

    return jobs[index];
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
      riggingDate: newJobData.riggingDate || new Date().toISOString().split('T')[0],
      deriggingDate: newJobData.deriggingDate || new Date().toISOString().split('T')[0],
      vehicleIds: sourceJob.vehicleIds || ['v1'],
      status: 'ACTIVE',
      mode: 'LOADING',
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
        photoUrls: [],
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
      weight: itemData.weight || '10 lbs',
      power: itemData.power || 'N/A',
      image: itemData.image || '',
      serialPrefix: itemData.serialPrefix || 'EQP',
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

    catalog[index] = { ...catalog[index], ...itemData };
    this.addAuditLog(user, '', 'Katalog Úprava', `Upravena položka katalogu: ${catalog[index].name}`, 'update');
    this.saveCatalog(catalog);

    return catalog[index];
  },

  deleteCatalogItem(catalogId, user) {
    const catalog = this.getCatalog();
    const itemToDelete = catalog.find(c => c.id === catalogId);
    if (!itemToDelete) return null;

    const filtered = catalog.filter(c => c.id !== catalogId);
    this.addAuditLog(user, '', 'Katalog Mazání', `Smazána položka z katalogu: ${itemToDelete.name}`, 'update');
    this.saveCatalog(filtered);

    return itemToDelete;
  },

  deleteJobItem(itemId, user) {
    const allItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const itemToDelete = allItems.find(i => i.id === itemId);
    if (!itemToDelete) return null;

    const filtered = allItems.filter(i => i.id !== itemId);
    this.addAuditLog(
      user,
      itemToDelete.jobId,
      'Odebrání položky',
      `${itemToDelete.name} (${itemToDelete.quantityRequested} ks) odebrán ze zakázky`,
      'update'
    );
    this.saveJobItems(filtered);

    return itemToDelete;
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
    item.quantityLoaded = 0;
    item.status = 'PENDING';

    allItems[index] = item;

    this.addAuditLog(
      user,
      item.jobId,
      mode === 'DERIGGING' ? 'Swipe Nenaloženo' : 'Swipe K naložení',
      `${item.name} zrušena nakládka, stav vrácen na K naložení (0/${item.quantityRequested} ks)`,
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
      item.quantityLoaded = item.quantityRequested;
      newStatus = mode === 'DERIGGING' ? 'PACKED' : 'LOADED';
      item.damageNotes = '';
      item.photoUrls = [];
    }

    item.status = newStatus;
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

    if (existingIndex !== -1) {
      allItems[existingIndex].quantityRequested += parseInt(quantity) || 1;
      this.addAuditLog(
        user,
        jobId,
        'Navýšení kusů Ad-Hoc',
        `${allItems[existingIndex].name} navýšen požadavek na ${allItems[existingIndex].quantityRequested} ks`,
        'add'
      );
      this.saveJobItems(allItems);
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
    };

    allItems.push(newItem);
    this.addAuditLog(
      user,
      jobId,
      'Přidána Ad-Hoc položka',
      `Vloženo nestandardní zařízení: ${newItem.name} (${newItem.quantityRequested} ks)`,
      'add'
    );
    this.saveJobItems(allItems);

    return newItem;
  },

  addCatalogItemToJob(jobId, catalogItem, vehicleId, user) {
    const allItems = JSON.parse(localStorage.getItem(KEYS.JOB_ITEMS) || '[]');
    const catalogList = this.getCatalog();

    if (catalogItem.isBundle && catalogItem.bundleItems && catalogItem.bundleItems.length > 0) {
      const addedSummary = [];

      catalogItem.bundleItems.forEach((sub, idx) => {
        const subName = sub.name;
        const subQty = sub.qty || 1;

        const existingIdx = allItems.findIndex(
          i => i.jobId === jobId && i.name.toLowerCase().trim() === subName.toLowerCase().trim()
        );

        if (existingIdx !== -1) {
          allItems[existingIdx].quantityRequested += subQty;
          addedSummary.push(`${subName} (+${subQty} ks)`);
        } else {
          const catalogMatch = catalogList.find(c => c.name.toLowerCase().trim() === subName.toLowerCase().trim());

          const subItem = {
            id: `ji-sub-${Date.now()}-${idx}`,
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
    } else {
      const existingIdx = allItems.findIndex(
        i => i.jobId === jobId && (i.catalogId === catalogItem.id || i.name.toLowerCase().trim() === catalogItem.name.toLowerCase().trim())
      );

      if (existingIdx !== -1) {
        allItems[existingIdx].quantityRequested += 1;
        this.addAuditLog(
          user,
          jobId,
          'Navýšení počtu z katalogu',
          `${catalogItem.name} navýšen počet požadovaných kusů na ${allItems[existingIdx].quantityRequested} ks`,
          'add'
        );
        this.saveJobItems(allItems);
      } else {
        const newItem = {
          id: `ji-cat-${Date.now()}`,
          jobId,
          catalogId: catalogItem.id,
          name: catalogItem.name,
          category: catalogItem.category,
          assignedVehicleId: vehicleId || 'v1',
          quantityRequested: 1,
          quantityLoaded: 0,
          status: 'PENDING',
          serialNumber: `${catalogItem.serialPrefix}-${Math.floor(100 + Math.random() * 900)}`,
          isAdHoc: false,
          isBundle: false,
          damageNotes: '',
          photoUrls: catalogItem.image ? [catalogItem.image] : [],
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

    this.addAuditLog(
      user,
      jobId,
      'Přepnutí režimu zakázky',
      `Režim zakázky přepnut na: ${newMode === 'DERIGGING' ? 'DERIGGING (Vracení z placu)' : 'NAKLÁDKA (Ze skladu)'}`,
      'update'
    );
    this.saveJobs(jobs);

    return jobs[index];
  },

  createJob(jobData, user) {
    const jobs = this.getJobs();
    const newJob = {
      id: 'job-' + Date.now(),
      name: jobData.name,
      client: jobData.client || 'Filmová Produkce',
      riggingDate: jobData.riggingDate || new Date().toISOString().split('T')[0],
      deriggingDate: jobData.deriggingDate || new Date().toISOString().split('T')[0],
      assignedGaffer: jobData.assignedGaffer || user || 'Petr M.',
      vehicleIds: jobData.vehicleIds || ['v1'],
      status: 'ACTIVE',
      mode: 'LOADING',
    };

    jobs.unshift(newJob);
    this.addAuditLog(
      user,
      newJob.id,
      'Vytvoření nové zakázky',
      `Založena nová zakázka: ${newJob.name} (${newJob.client})`,
      'add'
    );
    this.saveJobs(jobs);
    this.setCurrentJobId(newJob.id);

    return newJob;
  }
};
