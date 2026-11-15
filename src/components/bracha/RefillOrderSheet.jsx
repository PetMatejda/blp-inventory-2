import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Sheet, useDialogs } from '../common/Dialogs';
import { refillItems, refillOrderText } from '../../domain/refill';
import { plural } from '../../domain/labels';
import { Share2, Copy, Mail } from 'lucide-react';

/** Refill order for the Brácha kit: share / copy / e-mail the list of missing consumables. */
export const RefillOrderSheet = ({ onClose }) => {
  const { consumables, currentUser, logAudit } = useInventory();
  const { toast } = useDialogs();
  const [includeHalf, setIncludeHalf] = useState(true);

  const items = refillItems(consumables, { includeHalf });
  const text = refillOrderText(items, { by: currentUser?.name || '' });
  const subject = `Objednávka doplnění – Brácha (${new Date().toLocaleDateString('cs-CZ')})`;
  const sent = (how) => {
    logAudit('', 'Objednávka doplnění', `${how}: ${items.length} položek (${items.filter((i) => i.urgent).length} chybí)`, 'bracha');
  };

  const share = async () => {
    try {
      await navigator.share({ title: subject, text });
      sent('Sdíleno');
      onClose();
    } catch (err) {
      if (err?.name !== 'AbortError') toast({ text: 'Sdílení se nepodařilo — zkuste Kopírovat.' });
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      sent('Zkopírováno');
      toast({ text: 'Objednávka zkopírována' });
    } catch {
      toast({ text: 'Kopírování se nepodařilo.' });
    }
  };
  const email = () => {
    sent('E-mail');
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  };

  return (
    <Sheet title="Objednávka doplnění" subtitle={`${items.length} ${plural(items.length, 'položka', 'položky', 'položek')}`} onClose={onClose}>
      <label className="flex items-center gap-3 min-h-[44px] text-base">
        <input type="checkbox" className="w-6 h-6" checked={includeHalf} onChange={(e) => setIncludeHalf(e.target.checked)} />
        Přidat i položky na 50 %
      </label>
      <pre className="whitespace-pre-wrap text-sm bg-surface-container border border-outline-variant rounded-xl p-3 max-h-64 overflow-y-auto font-sans text-on-surface">{text}</pre>
      <div className="grid grid-cols-3 gap-2">
        {typeof navigator !== 'undefined' && navigator.share && (
          <button onClick={share} disabled={!items.length} className="h-14 rounded-2xl bg-secondary text-on-secondary font-bold flex flex-col items-center justify-center text-sm disabled:opacity-40">
            <Share2 className="w-5 h-5" /> Sdílet
          </button>
        )}
        <button onClick={copy} disabled={!items.length} className="h-14 rounded-2xl border border-outline-variant bg-surface-container font-semibold flex flex-col items-center justify-center text-sm disabled:opacity-40">
          <Copy className="w-5 h-5" /> Kopírovat
        </button>
        <button onClick={email} disabled={!items.length} className="h-14 rounded-2xl border border-outline-variant bg-surface-container font-semibold flex flex-col items-center justify-center text-sm disabled:opacity-40">
          <Mail className="w-5 h-5" /> E-mail
        </button>
      </div>
    </Sheet>
  );
};
