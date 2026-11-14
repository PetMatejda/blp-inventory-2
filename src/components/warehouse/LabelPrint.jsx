// Printable QR labels: A4 sheet of 3 × 8 labels (70 × 37 mm, common self-adhesive sheets).
// Rendered off-screen, shown only when printing (see index.css › #label-print).
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * labels: [{ payload, title, subtitle }]
 * Generates the QR codes, opens the browser print dialog, then calls onDone().
 */
export const LabelPrint = ({ labels, onDone }) => {
  const [images, setImages] = useState(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone; // print once per label set, not on every parent render

  useEffect(() => {
    let alive = true;
    (async () => {
      const QRCode = (await import('qrcode')).default;
      const urls = await Promise.all(labels.map((l) => QRCode.toDataURL(l.payload, { margin: 0, width: 240, errorCorrectionLevel: 'M' })));
      if (alive) setImages(urls);
    })().catch((err) => { console.error('[LabelPrint]', err); onDoneRef.current?.(err); });
    return () => { alive = false; };
  }, [labels]);

  useEffect(() => {
    if (!images) return undefined;
    const after = () => onDoneRef.current?.();
    window.addEventListener('afterprint', after, { once: true });
    const t = setTimeout(() => window.print(), 150); // let the images render first
    return () => { clearTimeout(t); window.removeEventListener('afterprint', after); };
  }, [images]);

  return createPortal(
    <div id="label-print" aria-hidden="true">
      <div className="label-sheet">
        {labels.map((l, i) => (
          <div className="label" key={`${l.payload}-${i}`}>
            {images && <img src={images[i]} alt="" />}
            <div className="label-text">
              <strong>{l.code || l.payload}</strong>
              <span>{l.title}</span>
              {l.subtitle && <small>{l.subtitle}</small>}
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
};
