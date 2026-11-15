import React from 'react';
import { Plus } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { ScannerScreen } from '../common/ScannerScreen';
import { phaseOf } from '../../domain/labels';

/** Packing screen scanner: what a scan means depends on the job phase (see stockActions.scanOnJob). */
export const BarcodeScannerModal = () => {
  const { isScannerModalOpen, setIsScannerModalOpen, currentJob, addCatalogItemToJob, stock } = useInventory();

  if (!isScannerModalOpen) return null;

  // Labelled units, catalog labels (BLP:…), EAN and serial numbers.
  const onCode = (code) => {
    const r = stock.scanOnJob(currentJob?.id, code);
    if (r.ok) return { type: 'success', text: r.message, detail: r.warning || code };
    if (r.needsAdd) {
      const item = r.needsAdd;
      return {
        type: 'ask',
        text: r.message,
        detail: `Kód ${code} — položka zatím není v zakázce`,
        actions: [{
          label: 'Přidat do zakázky (+1 ks)',
          icon: Plus,
          keepOpen: true,
          onClick: () => { addCatalogItemToJob(item); return { type: 'success', text: `Přidáno do zakázky: ${item.name}` }; },
        }],
      };
    }
    return { type: 'error', text: r.message, detail: code };
  };

  return (
    <ScannerScreen
      title={`Skener · ${phaseOf(currentJob?.mode).name}`}
      subtitle={currentJob?.name}
      onCode={onCode}
      onClose={() => setIsScannerModalOpen(false)}
    />
  );
};
