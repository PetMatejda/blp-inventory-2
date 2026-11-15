import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet, SheetAction, useDialogs } from '../common/Dialogs';
import { phaseOf } from '../../domain/labels';
import {
  FolderOpen, Edit2, Copy, FileText, Lock, Unlock, Image as ImageIcon, AlertTriangle,
  Trash2, Check, RefreshCw, Hash, Truck, Package, Warehouse,
} from 'lucide-react';

export const ContextMenuModal = () => {
  const {
    contextMenu, setContextMenu, setCurrentJobId, setActiveTab, setEditingJob, setTemplateJob,
    setIsProtocolModalOpen, reactivateJob, deleteJobItem, restoreJobItem, deleteJob, setDamageReportItem,
    updateConsumableState, setItemExactQuantity, setPhotoViewerItem, setFinishingJob, currentJob, changeJobPhase,
  } = useInventory();
  const { confirm, askNumber, toast } = useDialogs();

  if (!contextMenu) return null;
  const { type, target } = contextMenu;
  const close = () => setContextMenu(null);
  const run = (fn) => () => { close(); fn(); };

  // ── Item on a packing list ──
  if (type === 'PACKING_ITEM') {
    const mode = currentJob?.mode || 'LOADING';
    const archived = currentJob?.status === 'ARCHIVED';
    return (
      <Sheet title={target.name} subtitle={`${target.quantityLoaded} / ${target.quantityRequested} ks`} onClose={close}>
        <div className="flex flex-col gap-2">
          <SheetAction icon={Hash} label="Zadat počet kusů" hint={`${phaseOf(mode).doneLabel} kusů`} disabled={archived}
            onClick={run(async () => {
              const n = await askNumber({ title: target.name, message: `${phaseOf(mode).doneLabel} kusů`, value: target.quantityLoaded, max: target.quantityRequested });
              if (n != null) setItemExactQuantity(target.id, n);
            })} />
          <SheetAction icon={ImageIcon} label="Detail položky" onClick={run(() => setPhotoViewerItem(target))} />
          <SheetAction icon={AlertTriangle} label="Nahlásit závadu" disabled={archived} onClick={run(() => setDamageReportItem(target))} />
          <SheetAction icon={Trash2} label="Odebrat ze zakázky" danger disabled={archived}
            onClick={run(() => {
              const removed = deleteJobItem(target.id);
              if (removed) toast({ text: `${removed.name} odebrán`, actionLabel: 'Vrátit', onAction: () => restoreJobItem(removed) });
            })} />
        </div>
      </Sheet>
    );
  }

  // ── Job card ──
  if (type === 'JOB') {
    const archived = target.status === 'ARCHIVED';
    const derigging = target.mode === 'DERIGGING';
    const restock = target.mode === 'RESTOCK';
    return (
      <Sheet title={target.name} subtitle={target.client} onClose={close}>
        <div className="flex flex-col gap-2">
          <SheetAction icon={FolderOpen} label={archived ? 'Zobrazit seznam' : 'Otevřít balení'}
            onClick={run(() => { setCurrentJobId(target.id); setActiveTab('packing'); })} />
          {!archived && restock && (
            <SheetAction icon={Warehouse} label="Dokončit naskladnění…" hint="Souhrn pohybů ve skladu a archiv" onClick={run(() => setFinishingJob(target))} />
          )}
          {!archived && !restock && (
            <SheetAction icon={derigging ? Warehouse : Truck} label={derigging ? 'Zahájit naskladnění' : 'Zahájit derigging'}
              hint={derigging ? 'Počítání techniky zpět do skladu' : 'Balení na placu a odvoz'}
              onClick={run(async () => {
                if (await confirm(derigging ? {
                  title: 'Zahájit naskladnění?',
                  message: 'Sbalená technika se předvyplní jako naskladněná, opravují se jen rozdíly. Do deriggingu se pak nedá vrátit.',
                  confirmLabel: 'Zahájit naskladnění',
                } : {
                  title: 'Zahájit derigging?',
                  message: 'Naložené kusy se odepíšou ze skladu (vydáno na zakázku). Swipe bude znamenat „sbaleno k odvozu“.',
                  confirmLabel: 'Zahájit derigging',
                })) {
                  changeJobPhase(derigging ? 'RESTOCK' : 'DERIGGING', target.id);
                  setCurrentJobId(target.id);
                  setActiveTab('packing');
                }
              })} />
          )}
          {!archived && derigging && (
            <SheetAction icon={Package} label="Zpět na rigging" hint="Zruší výdej ze skladu"
              onClick={run(async () => {
                if (await confirm({ title: 'Vrátit zakázku do riggingu?', message: 'Výdej ze skladu se zruší a swipe bude znovu znamenat „naloženo“.', confirmLabel: 'Zpět na rigging' })) {
                  changeJobPhase('LOADING', target.id);
                }
              })} />
          )}
          <SheetAction icon={FileText} label="Předávací protokol (PDF)"
            onClick={run(() => { setCurrentJobId(target.id); setIsProtocolModalOpen(true); })} />
          <SheetAction icon={Edit2} label="Upravit název a termíny" onClick={run(() => setEditingJob(target))} />
          <SheetAction icon={Copy} label="Použít jako vzor" hint="Nová zakázka se stejnou technikou" onClick={run(() => setTemplateJob(target))} />
          {archived ? (
            <SheetAction icon={Unlock} label="Obnovit do aktivních" onClick={run(() => { reactivateJob(target.id); toast({ text: 'Zakázka obnovena' }); })} />
          ) : !restock && (
            <SheetAction icon={Lock} label="Ukončit zakázku…" hint="Souhrn, protokol a archiv" onClick={run(() => setFinishingJob(target))} />
          )}
          <SheetAction icon={Trash2} label="Trvale smazat zakázku" danger
            onClick={run(async () => {
              if (await confirm({
                title: `Smazat „${target.name}“?`,
                message: 'Zakázka i všechny její položky budou trvale smazány. Tuto akci nejde vrátit.\n\nPokud je zakázka hotová, použijte raději „Ukončit zakázku“ — zůstane v archivu.',
                confirmLabel: 'Trvale smazat',
                danger: true,
              })) deleteJob(target.id);
            })} />
        </div>
      </Sheet>
    );
  }

  // ── Consumable (Brácha) ──
  if (type === 'CONSUMABLE') {
    const setState = (s) => run(() => updateConsumableState(target.id, s));
    return (
      <Sheet title={target.name} onClose={close}>
        <div className="flex flex-col gap-2">
          <SheetAction icon={Check} label="OK – dostatek" onClick={setState(0)} />
          <SheetAction icon={AlertTriangle} label="50 % – brzy doplnit" onClick={setState(1)} />
          <SheetAction icon={RefreshCw} label="Chybí – doplnit" danger onClick={setState(2)} />
        </div>
      </Sheet>
    );
  }

  return null;
};
