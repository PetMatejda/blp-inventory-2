import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet } from '../common/Dialogs';
import { usePhotoSrc } from '../../services/photoService';
import { getCategoryMeta } from '../../utils/categoryIcons';
import { statusLabel } from '../../domain/labels';

const Photo = ({ src, alt }) => {
  const url = usePhotoSrc(src);
  if (!url) return <div className="aspect-[4/3] rounded-xl bg-surface-container animate-pulse" />;
  return <img src={url} alt={alt} className="w-full rounded-xl border border-outline-variant object-contain max-h-[50vh] bg-surface-container-lowest" />;
};

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-3 py-2 border-b border-outline-variant/50 text-sm">
    <span className="text-on-surface-variant">{label}</span>
    <span className="text-on-surface font-semibold text-right break-words min-w-0">{children}</span>
  </div>
);

/** Photos (catalog picture + damage photos) and details of a job item. */
export const PhotoViewer = () => {
  const { photoViewerItem: item, setPhotoViewerItem, currentJob } = useInventory();
  if (!item) return null;

  const photos = [...new Set([...(item.photoUrls || []), item.image].filter(Boolean))];
  const cat = getCategoryMeta(item.category);

  return (
    <Sheet title={item.name} subtitle={cat.label} onClose={() => setPhotoViewerItem(null)}>
      {photos.length === 0
        ? <p className="text-sm text-on-surface-variant">Bez fotky.</p>
        : <div className="flex flex-col gap-3">{photos.map((p) => <Photo key={p} src={p} alt={item.name} />)}</div>}
      <div>
        <Row label="Stav">{statusLabel(item.status, currentJob?.mode)}</Row>
        <Row label="Počet">{item.quantityLoaded} / {item.quantityRequested} ks</Row>
        {item.serialNumber && <Row label="Sériové číslo"><span className="font-mono">{item.serialNumber}</span></Row>}
        {item.barcode && <Row label="Čárový kód"><span className="font-mono">{item.barcode}</span></Row>}
        {item.status === 'DAMAGED' && <Row label="Závada">{item.damageNotes || '—'}</Row>}
        {item.updatedBy && <Row label="Naposledy změnil">{item.updatedBy}</Row>}
      </div>
    </Sheet>
  );
};
