// Handover protocol PDF (FUNKCNI_SPECIFIKACE.md, section 6.1).
// jsPDF and html2canvas are loaded on demand so they do not slow down app start.

const STATUS_LABELS = {
  PENDING: 'Čeká',
  LOADED: 'Naloženo',
  PACKED: 'Sbaleno',
  DAMAGED: 'Závada',
  RESTOCKED: 'Naskladněno',
};

const STATUS_STYLES = {
  LOADED: 'background-color: #d1fae5; color: #065f46;',
  PACKED: 'background-color: #cffafe; color: #155e75;',
  DAMAGED: 'background-color: #fee2e2; color: #991b1b;',
};

const SEVERITY_LABELS = {
  LIGHT: 'Lehké (kosmetické)',
  MAJOR: 'Nefunkční',
  CRITICAL: 'Kritické (riziko)',
};

/** Escapes user-entered text before it goes into the protocol HTML. */
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isSafeImageData = (src) => typeof src === 'string' && src.startsWith('data:image/png;base64,');

export function summarizeItems(items) {
  const totalRequested = items.reduce((sum, item) => sum + (item.quantityRequested || 0), 0);
  const totalLoaded = items.reduce((sum, item) => sum + (item.quantityLoaded || 0), 0);
  const damagedItems = items.filter((item) => item.status === 'DAMAGED');
  const progressPercent = totalRequested > 0 ? Math.round((totalLoaded / totalRequested) * 100) : 0;
  return { totalRequested, totalLoaded, damagedItems, progressPercent };
}

/** Builds the protocol HTML. Pure function — covered by tests. */
export function buildProtocolHtml(job, items, vehicles = [], signatureGafferData = null, signatureCustodianData = null, now = new Date()) {
  const e = escapeHtml;
  const assignedVehicles = vehicles.filter((v) => job.vehicleIds?.includes(v.id)).map((v) => (v.plate ? `${v.name} (${v.plate})` : v.name)).join(', ') || 'Není přiřazeno';
  const { totalRequested, totalLoaded, damagedItems, progressPercent } = summarizeItems(items);
  const modeLabel = job.mode === 'DERIGGING' ? 'Derigging (vracení z placu)' : 'Rigging (nakládka ze skladu)';

  const itemsHtml = items.map((item, index) => `
      <tr style="border-bottom: 1px solid #e1e2ec; font-size: 13px; text-align: left;">
        <td style="padding: 8px 6px;">${index + 1}</td>
        <td style="padding: 8px 6px; font-weight: 600;">${e(item.name)}</td>
        <td style="padding: 8px 6px;">${e(item.category)}</td>
        <td style="padding: 8px 6px; font-family: monospace;">${e(item.serialNumber || '-')}</td>
        <td style="padding: 8px 6px; text-align: center; font-weight: 700;">${Number(item.quantityLoaded) || 0} / ${Number(item.quantityRequested) || 0}</td>
        <td style="padding: 8px 6px; text-align: right;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; ${STATUS_STYLES[item.status] || 'background-color: #f3f4f6; color: #4b5563;'}">
            ${e(STATUS_LABELS[item.status] || item.status)}
          </span>
        </td>
      </tr>`).join('');

  const damagedHtml = damagedItems.length > 0
    ? damagedItems.map((item) => `
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin-bottom: 8px; border-radius: 4px;">
        <strong style="color: #991b1b;">${e(item.name)} (${e(item.serialNumber || 'Bez SN')})</strong> – <span style="font-weight: 700;">${e(SEVERITY_LABELS[item.damageSeverity] || item.damageSeverity || 'Závada')}</span>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #7f1d1d;">${e(item.damageNotes || 'Bez popisu')}</p>
      </div>`).join('')
    : '<p style="font-size: 13px; color: #059669; font-weight: 500;">Žádné položky nebyly nahlášeny jako poškozené.</p>';

  const signatureBox = (data) => isSafeImageData(data)
    ? `<img src="${data}" style="max-height: 80px; max-width: 100%;" />`
    : '<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Podpis nepřipojen</span>';

  return `
      <div style="border-bottom: 3px solid #004395; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #004395;">BLP INVENTORY</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 600; color: #4b5563;">PŘEDÁVACÍ PROTOKOL FILMOVÉ TECHNIKY</p>
        </div>
        <div style="text-align: right; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;"><strong>Datum vystavení:</strong> ${now.toLocaleDateString('cs-CZ')} ${now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</p>
          <p style="margin: 2px 0 0 0;"><strong>Fáze:</strong> ${modeLabel}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background-color: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
        <div>
          <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Název zakázky:</strong> ${e(job.name)}</p>
          <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Klient / Produkce:</strong> ${e(job.client || 'Nespecifikováno')}</p>
          <p style="margin: 0; font-size: 13px;"><strong>Odpovědný Gaffer:</strong> ${e(job.assignedGaffer || 'Nezadáno')}</p>
        </div>
        <div>
          <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Přiřazená vozidla:</strong> ${e(assignedVehicles)}</p>
          <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Zpracováno:</strong> ${totalLoaded} z ${totalRequested} ks (${progressPercent} %)</p>
          <p style="margin: 0; font-size: 13px;"><strong>Počet závad:</strong> ${damagedItems.length} položek</p>
        </div>
      </div>

      <h2 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Soupis techniky na zakázce</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569;">
            <th style="padding: 8px 6px; width: 30px;">#</th>
            <th style="padding: 8px 6px;">Zařízení</th>
            <th style="padding: 8px 6px;">Kategorie</th>
            <th style="padding: 8px 6px;">Inv. číslo</th>
            <th style="padding: 8px 6px; text-align: center;">Kusy</th>
            <th style="padding: 8px 6px; text-align: right;">Stav</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <h2 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Evidované poruchy a závady</h2>
      <div style="margin-bottom: 32px;">${damagedHtml}</div>

      <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; border-top: 2px dashed #cbd5e1; padding-top: 24px;">
        <div style="text-align: center;">
          <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 8px;">Předal (Lead Gaffer):</p>
          <div style="height: 90px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${signatureBox(signatureGafferData)}
          </div>
          <p style="font-size: 12px; margin-top: 6px; color: #334155;">${e(job.assignedGaffer || '')}</p>
        </div>
        <div style="text-align: center;">
          <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 8px;">Přebral (Skladník):</p>
          <div style="height: 90px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${signatureBox(signatureCustodianData)}
          </div>
          <p style="font-size: 12px; margin-top: 6px; color: #334155;">Skladník BLP</p>
        </div>
      </div>`;
}

export const protocolFileName = (job, now = new Date()) => {
  const safeName = String(job.name || 'zakazka')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'zakazka';
  return `BLP_Protokol_${safeName}_${now.toISOString().split('T')[0]}.pdf`;
};

export const pdfService = {
  async generateHandoverProtocolPDF(job, items, vehicles, userRole, signatureGafferData, signatureCustodianData) {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);

    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'absolute', left: '-9999px', top: '-9999px', width: '800px', padding: '32px',
      backgroundColor: '#ffffff', color: '#10131a', fontFamily: 'Inter, sans-serif',
    });
    container.innerHTML = buildProtocolHtml(job, items, vehicles, signatureGafferData, signatureCustodianData);
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;

      // Long equipment lists continue on further A4 pages instead of being cut off.
      // Each page gets only its own slice as JPEG (a full-page PNG per page made
      // a 3-page protocol ~40 MB).
      const pageHeightPx = Math.floor((canvas.width * pageHeight) / pageWidth);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      const ctx = slice.getContext('2d');

      for (let y = 0, page = 0; y < canvas.height; y += pageHeightPx, page++) {
        const h = Math.min(pageHeightPx, canvas.height - y);
        slice.height = h;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, h);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, pageWidth, (h * pageWidth) / canvas.width);
      }

      pdf.save(protocolFileName(job));
    } finally {
      document.body.removeChild(container);
    }
  },
};
