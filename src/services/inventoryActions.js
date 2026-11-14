// Everything a user can do with the inventory, written against a small repo
// interface ({ newId, set, update, remove, commit }) so it can be tested with an
// in-memory repo. Rules for item states live in src/domain/items.js.
import {
  applyQuantityDelta, applyExactQuantity, markDone, markUndone, toggleStatus, reportDamage,
  findSameEquipment, newItemFromCatalog, expandBundle, newAdHocItem, adHocName, copyItemsForTemplate,
} from '../domain/items.js';

const today = () => new Date().toISOString().split('T')[0];
const CONSUMABLE_LABELS = ['OK', '50%', 'REFILL'];

/**
 * @param repo      data layer ({ newId, set, update, remove, commit })
 * @param getState  () => ({ jobs, jobItems, catalog, consumables }) — current snapshot
 * @param getActor  () => 'Name (ROLE)' for audit entries
 */
export function createInventoryActions({ repo, getState, getActor }) {
  const now = () => new Date().toISOString();
  const stamp = (data) => ({ ...data, updatedAt: now(), updatedBy: getActor() });

  const auditOp = (jobId, action, detail, type = 'update') => {
    const id = repo.newId('auditLogs');
    return {
      type: 'set', col: 'auditLogs', id,
      data: { id, timestamp: now(), user: getActor(), jobId: jobId || '', action, detail, type },
    };
  };
  const audit = (...args) => { const op = auditOp(...args); repo.set(op.col, op.id, op.data); };

  const findItem = (id) => getState().jobItems.find((i) => i.id === id);
  const findJob = (id) => getState().jobs.find((j) => j.id === id);
  const jobItemsOf = (jobId) => getState().jobItems.filter((i) => i.jobId === jobId);

  const patchItem = (item, patch, action, detail, type = 'loaded') => {
    repo.commit([
      { type: 'update', col: 'jobItems', id: item.id, data: stamp(patch) },
      auditOp(item.jobId, action, detail, type),
    ]);
    return { ...item, ...patch };
  };

  const createItems = (items) => items.map((data) => {
    const id = repo.newId('jobItems');
    return { type: 'set', col: 'jobItems', id, data: stamp({ ...data, id }) };
  });

  return {
    // ── Job items ──────────────────────────────────────────────
    updateItemQuantity(itemId, delta, mode) {
      const item = findItem(itemId);
      if (!item) return null;
      const patch = applyQuantityDelta(item, delta, mode);
      return patchItem(item, patch, delta > 0 ? 'Přičtení kusů' : 'Odečtení kusů',
        `${item.name}: ${patch.quantityLoaded}/${patch.quantityRequested} ks, stav ${item.status} → ${patch.status}`);
    },

    setItemExactQuantity(itemId, exact, mode) {
      const item = findItem(itemId);
      if (!item) return null;
      const patch = applyExactQuantity(item, exact, mode);
      return patchItem(item, patch, 'Ruční zadání počtu',
        `${item.name}: ${patch.quantityLoaded}/${patch.quantityRequested} ks`);
    },

    setItemLoadedOrPacked(itemId, mode) {
      const item = findItem(itemId);
      if (!item) return null;
      const patch = markDone(item, mode);
      return patchItem(item, patch, mode === 'DERIGGING' ? 'Swipe Sbaleno' : 'Swipe Naloženo',
        `${item.name} v plném počtu (${patch.quantityLoaded}/${item.quantityRequested} ks)`);
    },

    setItemPending(itemId, mode) {
      const item = findItem(itemId);
      if (!item) return null;
      const patch = markUndone(item, mode);
      return patchItem(item, patch, mode === 'DERIGGING' ? 'Swipe Vráceno na place' : 'Swipe K naložení',
        `${item.name} (${patch.quantityLoaded}/${item.quantityRequested} ks)`);
    },

    toggleItemStatus(itemId, mode) {
      const item = findItem(itemId);
      if (!item) return null;
      const patch = toggleStatus(item, mode);
      const wasDamaged = item.status === 'DAMAGED';
      return patchItem(item, patch, wasDamaged ? 'Zrušení závady' : 'Změna stavu',
        `${item.name} → ${patch.status}`, wasDamaged ? 'damage' : 'loaded');
    },

    reportItemDamage(itemId, severity, notes, photoUrl) {
      const item = findItem(itemId);
      if (!item) return null;
      const patch = reportDamage(item, severity, notes, photoUrl);
      return patchItem(item, patch, 'Hlášení poškození',
        `${item.name} označen jako ${severity}. Poznámka: ${notes || '—'}`, 'damage');
    },

    deleteJobItem(itemId) {
      const item = findItem(itemId);
      if (!item) return null;
      repo.commit([
        { type: 'delete', col: 'jobItems', id: item.id },
        auditOp(item.jobId, 'Odebrání položky', `${item.name} (${item.quantityRequested} ks) odebrán ze zakázky`),
      ]);
      return item;
    },

    /** Undo of deleteJobItem: puts the same record back (same ID and data). */
    restoreJobItem(item) {
      if (!item?.id) return null;
      const { id, ...data } = item;
      repo.commit([
        { type: 'set', col: 'jobItems', id, data: stamp({ ...data, id }) },
        auditOp(item.jobId, 'Vrácení odebrané položky', `${item.name} (${item.quantityRequested} ks) vrácen do zakázky`),
      ]);
      return item;
    },

    addAdHocItem(jobId, name, category, quantity) {
      const qty = Math.max(1, parseInt(quantity, 10) || 1);
      const existing = findSameEquipment(jobItemsOf(jobId), jobId, { name: adHocName(name) });
      if (existing) {
        const requested = (existing.quantityRequested || 0) + qty;
        return patchItem(existing, { quantityRequested: requested, status: existing.quantityLoaded >= requested ? existing.status : 'PENDING' },
          'Navýšení kusů Ad-Hoc', `${existing.name} navýšen požadavek na ${requested} ks`, 'add');
      }
      const ops = createItems([newAdHocItem(jobId, name, category, qty)]);
      repo.commit([...ops, auditOp(jobId, 'Přidána Ad-Hoc položka', `${ops[0].data.name} (${qty} ks)`, 'add')]);
      return ops[0].data;
    },

    addCatalogItemToJob(jobId, catalogItem) {
      const { catalog } = getState();
      const items = jobItemsOf(jobId);

      if (catalogItem.isBundle && catalogItem.bundleItems?.length) {
        const { updates, creates, summary } = expandBundle(jobId, catalogItem, items, catalog);
        repo.commit([
          ...updates.map(({ item, patch }) => ({
            type: 'update', col: 'jobItems', id: item.id,
            data: stamp({ ...patch, status: (item.quantityLoaded || 0) >= patch.quantityRequested ? item.status : 'PENDING' }),
          })),
          ...createItems(creates),
          auditOp(jobId, 'Vložení dílů ze setu', `Ze setu ${catalogItem.name}: ${summary.join(', ')}`, 'add'),
        ]);
        return;
      }

      const existing = findSameEquipment(items, jobId, { catalogId: catalogItem.id, name: catalogItem.name });
      if (existing) {
        const requested = (existing.quantityRequested || 0) + 1;
        patchItem(existing, { quantityRequested: requested, status: (existing.quantityLoaded || 0) >= requested ? existing.status : 'PENDING' },
          'Navýšení počtu z katalogu', `${catalogItem.name} navýšen na ${requested} ks`, 'add');
        return;
      }
      const ops = createItems([newItemFromCatalog(jobId, catalogItem)]);
      repo.commit([...ops, auditOp(jobId, 'Přidáno z katalogu', `${catalogItem.name} vloženo do zakázky (1 ks)`, 'add')]);
    },

    // ── Jobs ───────────────────────────────────────────────────
    createJob(jobData) {
      const id = repo.newId('jobs');
      const job = stamp({
        id,
        name: jobData.name,
        client: jobData.client || '',
        assignedGaffer: jobData.assignedGaffer || '',
        blpResponsible: jobData.blpResponsible || '',
        riggingDate: jobData.riggingDate || today(),
        deriggingDate: jobData.deriggingDate || today(),
        vehicleIds: jobData.vehicleIds || ['v1'],
        status: 'ACTIVE',
        mode: 'LOADING',
      });
      repo.commit([
        { type: 'set', col: 'jobs', id, data: job },
        auditOp(id, 'Nová zakázka', `Vytvořena zakázka: ${job.name}`, 'add'),
      ]);
      return job;
    },

    updateJob(jobId, jobData) {
      const job = findJob(jobId);
      if (!job) return null;
      repo.commit([
        { type: 'update', col: 'jobs', id: jobId, data: stamp(jobData) },
        auditOp(jobId, 'Úprava zakázky', `Upraveny údaje zakázky ${jobData.name || job.name}`),
      ]);
      return { ...job, ...jobData };
    },

    setJobStatus(jobId, status) {
      const job = findJob(jobId);
      if (!job) return null;
      const archived = status === 'ARCHIVED';
      repo.commit([
        { type: 'update', col: 'jobs', id: jobId, data: stamp({ status }) },
        auditOp(jobId, archived ? 'Ukončení zakázky' : 'Obnovení zakázky',
          archived ? `Zakázka ${job.name} byla dokončena a uzamčena do archivu.` : `Zakázka ${job.name} byla vrácena do aktivního stavu.`),
      ]);
      return { ...job, status };
    },

    setJobMode(jobId, mode) {
      const job = findJob(jobId);
      if (!job || job.mode === mode) return null;
      const labels = { LOADING: 'RIGGING (ze skladu na plac)', DERIGGING: 'DERIGGING (vracení z placu)', RESTOCK: 'NASKLADNĚNÍ (zpět do skladu)' };
      repo.commit([
        { type: 'update', col: 'jobs', id: jobId, data: stamp({ mode }) },
        auditOp(jobId, 'Přepnutí fáze zakázky', labels[mode] || mode),
      ]);
      return { ...job, mode };
    },

    toggleJobMode(jobId) {
      const job = findJob(jobId);
      if (!job) return null;
      const mode = (job.mode || 'LOADING') === 'LOADING' ? 'DERIGGING' : 'LOADING';
      repo.commit([
        { type: 'update', col: 'jobs', id: jobId, data: stamp({ mode }) },
        auditOp(jobId, 'Přepnutí režimu zakázky', mode === 'DERIGGING' ? 'DERIGGING (vracení z placu)' : 'RIGGING (ze skladu na plac)'),
      ]);
      return { ...job, mode };
    },

    deleteJob(jobId) {
      const job = findJob(jobId);
      if (!job) return null;
      const items = jobItemsOf(jobId);
      // Firestore batches hold max 500 writes; very large jobs are split.
      const deletes = items.map((i) => ({ type: 'delete', col: 'jobItems', id: i.id }));
      for (let i = 0; i < deletes.length; i += 400) repo.commit(deletes.slice(i, i + 400));
      repo.commit([
        { type: 'delete', col: 'jobs', id: jobId },
        auditOp(jobId, 'Smazána zakázka', `Zakázka ${job.name} byla trvale smazána včetně ${items.length} položek`, 'delete'),
      ]);
      return true;
    },

    duplicateJobAsTemplate(sourceJobId, newJobData) {
      const source = findJob(sourceJobId);
      if (!source) return null;
      const id = repo.newId('jobs');
      const job = stamp({
        id,
        name: newJobData.name || `${source.name} (Kopie)`,
        client: newJobData.client ?? source.client ?? '',
        assignedGaffer: newJobData.assignedGaffer ?? source.assignedGaffer ?? '',
        blpResponsible: newJobData.blpResponsible ?? source.blpResponsible ?? '',
        riggingDate: newJobData.riggingDate || today(),
        deriggingDate: newJobData.deriggingDate || today(),
        vehicleIds: source.vehicleIds || ['v1'],
        status: 'ACTIVE',
        mode: 'LOADING',
      });
      const itemOps = createItems(copyItemsForTemplate(jobItemsOf(sourceJobId), id));
      const ops = [
        { type: 'set', col: 'jobs', id, data: job },
        ...itemOps,
        auditOp(id, 'Kopie zakázky ze vzoru', `Nová zakázka ${job.name} ze vzoru ${source.name} (${itemOps.length} položek)`, 'add'),
      ];
      for (let i = 0; i < ops.length; i += 400) repo.commit(ops.slice(i, i + 400));
      return job;
    },

    // ── Catalog ────────────────────────────────────────────────
    createCatalogItem(itemData) {
      const id = repo.newId('catalog');
      const item = stamp({
        id,
        name: itemData.name,
        category: itemData.category || 'Lights',
        weight: itemData.weight || '',
        power: itemData.power || '',
        image: itemData.image || '',
        serialPrefix: itemData.serialPrefix || 'EQP',
        barcode: itemData.barcode || '',
        availableCount: parseInt(itemData.availableCount, 10) || 1,
        isBundle: !!itemData.isBundle,
        bundleItems: itemData.bundleItems || [],
      });
      repo.commit([
        { type: 'set', col: 'catalog', id, data: item },
        auditOp('', 'Katalog – přidání', `Nová položka v katalogu: ${item.name}`, 'add'),
      ]);
      return item;
    },

    updateCatalogItem(catalogId, itemData) {
      const { catalog, jobItems } = getState();
      const old = catalog.find((c) => c.id === catalogId);
      if (!old) return null;
      const ops = [
        { type: 'update', col: 'catalog', id: catalogId, data: stamp(itemData) },
        auditOp('', 'Katalog – úprava', old.name !== itemData.name && itemData.name
          ? `Přejmenováno: „${old.name}“ → „${itemData.name}“` : `Upravena položka katalogu: ${old.name}`),
      ];
      // A renamed catalog item is renamed in jobs that use it as well.
      if (itemData.name && itemData.name !== old.name) {
        jobItems.filter((i) => i.catalogId === catalogId).forEach((i) => ops.push({
          type: 'update', col: 'jobItems', id: i.id,
          data: stamp({ name: itemData.name, category: itemData.category || i.category, ...(itemData.image ? { photoUrls: [itemData.image] } : {}) }),
        }));
      }
      for (let i = 0; i < ops.length; i += 400) repo.commit(ops.slice(i, i + 400));
      return { ...old, ...itemData };
    },

    deleteCatalogItem(catalogId) {
      const old = getState().catalog.find((c) => c.id === catalogId);
      if (!old) return null;
      repo.commit([
        { type: 'delete', col: 'catalog', id: catalogId },
        auditOp('', 'Katalog – smazání', `Smazána položka z katalogu: ${old.name}`),
      ]);
      return old;
    },

    // ── Consumables (Brácha) ───────────────────────────────────
    updateConsumableState(consumableId, newState) {
      const item = getState().consumables.find((c) => c.id === consumableId);
      if (!item) return null;
      const stateLabel = CONSUMABLE_LABELS[newState] || 'OK';
      repo.commit([
        { type: 'update', col: 'consumables', id: consumableId, data: stamp({ state: newState, stateLabel }) },
        auditOp('', 'Brácha – změna', `${item.name}: ${stateLabel}`, 'bracha'),
      ]);
      return { ...item, state: newState, stateLabel };
    },

    audit,
  };
}
