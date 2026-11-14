import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { BookOpen } from 'lucide-react';

/** Shown when the shared catalog is empty (e.g. it was not part of the migrated data). */
export const RestoreCatalogCard = () => {
  const { restoreCatalogFromBackup } = useInventory();
  const [busy, setBusy] = useState(false);
  return (
    <div className="bg-card-bg border border-tertiary/40 rounded-2xl p-5 text-center flex flex-col items-center gap-3">
      <BookOpen className="w-12 h-12 text-tertiary" />
      <p className="text-lg font-bold text-on-surface">Katalog techniky je prázdný</p>
      <p className="text-sm text-on-surface-variant max-w-sm">
        Obnoví se z původních dat (záloha před převodem). Pokud tam katalog není, použije se výchozí katalog aplikace. Existující položky se nepřepíšou.
      </p>
      <button
        disabled={busy}
        onClick={async () => { setBusy(true); await restoreCatalogFromBackup(); setBusy(false); }}
        className="h-14 px-6 rounded-2xl bg-primary text-on-primary-container font-bold disabled:opacity-60"
      >
        {busy ? 'Obnovuji…' : 'Obnovit katalog'}
      </button>
    </div>
  );
};
