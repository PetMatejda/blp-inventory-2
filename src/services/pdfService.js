import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const pdfService = {
  async generateHandoverProtocolPDF(job, items, vehicles, userRole, signatureGafferData, signatureCustodianData) {
    // Create an offscreen DOM container for PDF rendering
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px';
    container.style.padding = '32px';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#10131a';
    container.style.fontFamily = 'Inter, sans-serif';

    const assignedVehicles = vehicles.filter(v => job.vehicleIds?.includes(v.id)).map(v => v.name).join(', ') || 'Není přiřazeno';
    
    const totalRequested = items.reduce((sum, item) => sum + item.quantityRequested, 0);
    const totalLoaded = items.reduce((sum, item) => sum + item.quantityLoaded, 0);
    const damagedItems = items.filter(item => item.status === 'DAMAGED');
    const progressPercent = totalRequested > 0 ? Math.round((totalLoaded / totalRequested) * 100) : 0;

    const itemsHtml = items.map((item, index) => `
      <tr style="border-bottom: 1px solid #e1e2ec; font-size: 13px; text-align: left;">
        <td style="padding: 8px 6px;">${index + 1}</td>
        <td style="padding: 8px 6px; font-weight: 600;">${item.name}</td>
        <td style="padding: 8px 6px;">${item.category}</td>
        <td style="padding: 8px 6px; font-family: monospace;">${item.serialNumber || '-'}</td>
        <td style="padding: 8px 6px; text-align: center; font-weight: 700;">${item.quantityLoaded} / ${item.quantityRequested}</td>
        <td style="padding: 8px 6px; text-align: right;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; ${
            item.status === 'LOADED' ? 'background-color: #d1fae5; color: #065f46;' :
            item.status === 'PACKED' ? 'background-color: #fef3c7; color: #92400e;' :
            item.status === 'DAMAGED' ? 'background-color: #fee2e2; color: #991b1b;' :
            'background-color: #f3f4f6; color: #4b5563;'
          }">
            ${item.status}
          </span>
        </td>
      </tr>
    `).join('');

    const damagedHtml = damagedItems.length > 0 ? damagedItems.map(item => `
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin-bottom: 8px; border-radius: 4px;">
        <strong style="color: #991b1b;">${item.name} (${item.serialNumber || 'Bez SN'})</strong> - <span style="font-weight: 700;">${item.damageSeverity || 'ZÁVADA'}</span>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #7f1d1d;">${item.damageNotes || 'Bez popisu'}</p>
      </div>
    `).join('') : '<p style="font-size: 13px; color: #059669; font-weight: 500;">Žádné položky nebyly nahlášeny jako poškozené.</p>';

    container.innerHTML = `
      <div style="border-bottom: 3px solid #004395; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #004395; tracking-tight: true;">BLP INVENTORY</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 600; color: #4b5563;">PŘEDÁVACÍ PROTOKOL FILMOVÉ TECHNIKY</p>
        </div>
        <div style="text-align: right; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;"><strong>Datum vystavení:</strong> ${new Date().toLocaleDateString('cs-CZ')} ${new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</p>
          <p style="margin: 2px 0 0 0;"><strong>Protokol ID:</strong> PRT-${Math.floor(100000 + Math.random() * 900000)}</p>
        </div>
      </div>

      <!-- General Info Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background-color: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
        <div>
          <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Název zakázky:</strong> ${job.name}</p>
          <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Klient / Produkce:</strong> ${job.client || 'Nespecifikováno'}</p>
          <p style="margin: 0; font-size: 13px;"><strong>Odpovědný Gaffer:</strong> ${job.assignedGaffer}</p>
        </div>
        <div>
          <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Přiřazená vozidla:</strong> ${assignedVehicles}</p>
          <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Stav nakládky:</strong> ${totalLoaded} z ${totalRequested} ks (${progressPercent} %)</p>
          <p style="margin: 0; font-size: 13px;"><strong>Počet závad:</strong> ${damagedItems.length} položek</p>
        </div>
      </div>

      <!-- Equipment Table -->
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
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Damage Section -->
      <h2 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Evidované poruchy a závady</h2>
      <div style="margin-bottom: 32px;">
        ${damagedHtml}
      </div>

      <!-- Signatures Block -->
      <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; border-top: 2px dashed #cbd5e1; padding-top: 24px;">
        <div style="text-align: center;">
          <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 8px;">Předal (Lead Gaffer):</p>
          <div style="height: 90px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${signatureGafferData ? `<img src="${signatureGafferData}" style="max-height: 80px; max-width: 100%; object-contain: true;" />` : '<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Podpis nepřipojen</span>'}
          </div>
          <p style="font-size: 12px; margin-top: 6px; color: #334155;">${job.assignedGaffer}</p>
        </div>
        <div style="text-align: center;">
          <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 8px;">Přebral (Skladník / Custodian):</p>
          <div style="height: 90px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${signatureCustodianData ? `<img src="${signatureCustodianData}" style="max-height: 80px; max-width: 100%; object-contain: true;" />` : '<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Podpis nepřipojen</span>'}
          </div>
          <p style="font-size: 12px; margin-top: 6px; color: #334155;">Rental Custodian</p>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`BLP_Protocol_${job.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      document.body.removeChild(container);
    }
  }
};
