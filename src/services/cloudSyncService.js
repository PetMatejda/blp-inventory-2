const SYNC_QUEUE_KEY = 'blp_sync_queue_v1';

export const cloudSyncService = {
  getQueue() {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
  },

  enqueue(actionType, payload) {
    const queue = this.getQueue();
    const entry = {
      id: 'sync-' + Date.now(),
      timestamp: new Date().toISOString(),
      actionType,
      payload,
    };
    queue.push(entry);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    console.log('[CloudSync] Změna uložena do offline fronty:', entry);
    return entry;
  },

  async syncPendingChanges() {
    const queue = this.getQueue();
    if (queue.length === 0) return { synced: 0 };

    console.log(`[CloudSync] Zahajování synchronizace ${queue.length} zálohovaných položek do cloudu...`);

    // Simulate batch cloud sync push
    await new Promise((resolve) => setTimeout(resolve, 800));

    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
    console.log('[CloudSync] Všechny offline změny byly úspěšně synchronizovány s cloudem.');

    return { synced: queue.length };
  },

  initAutoSync(onSyncComplete) {
    window.addEventListener('online', async () => {
      console.log('[CloudSync] Detekováno připojení k internetu. Spouštím synchronizaci...');
      const res = await this.syncPendingChanges();
      if (onSyncComplete && res.synced > 0) {
        onSyncComplete(res.synced);
      }
    });
  }
};
