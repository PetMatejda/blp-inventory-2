import React, { useRef, useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { pdfService } from '../../services/pdfService';
import { Download, Eraser } from 'lucide-react';
import { Sheet } from '../common/Dialogs';
import { SheetButtons } from '../common/FormField';

export const ProtocolModal = () => {
  const { isProtocolModalOpen, setIsProtocolModalOpen, currentJob, jobItems, vehicles, userRole } = useInventory();

  const canvasGafferRef = useRef(null);
  const canvasCustodianRef = useRef(null);

  const [isDrawingGaffer, setIsDrawingGaffer] = useState(false);
  const [isDrawingCustodian, setIsDrawingCustodian] = useState(false);
  const [gafferHasSigned, setGafferHasSigned] = useState(false);
  const [custodianHasSigned, setCustodianHasSigned] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfError, setPdfError] = useState('');

  if (!isProtocolModalOpen || !currentJob) return null;

  // Canvas is drawn at a fixed resolution but stretched by CSS, so scale the
  // pointer position into canvas coordinates (otherwise the line is offset).
  const getPoint = (canvas, e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) * canvas.width) / rect.width,
      y: ((clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const handleClose = () => {
    setGafferHasSigned(false);
    setCustodianHasSigned(false);
    setPdfError('');
    setIsProtocolModalOpen(false);
  };

  // Simple Canvas Drawing handlers
  const startDrawing = (canvasRef, setDrawingState, setSignedState) => (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPoint(canvas, e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#004395';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    setDrawingState(true);
    setSignedState(true);
  };

  const draw = (canvasRef, isDrawingState) => (e) => {
    if (!isDrawingState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPoint(canvas, e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (setDrawingState) => () => {
    setDrawingState(false);
  };

  const clearCanvas = (canvasRef, setSignedState) => () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignedState(false);
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    setPdfError('');

    const gafferData = gafferHasSigned && canvasGafferRef.current ? canvasGafferRef.current.toDataURL('image/png') : null;
    const custodianData = custodianHasSigned && canvasCustodianRef.current ? canvasCustodianRef.current.toDataURL('image/png') : null;

    try {
      await pdfService.generateHandoverProtocolPDF(
        currentJob,
        jobItems,
        vehicles,
        userRole,
        gafferData,
        custodianData
      );
      handleClose();
    } catch (err) {
      console.error('[Protocol] PDF generation failed:', err);
      setPdfError('PDF se nepodařilo vytvořit. Zkuste to prosím znovu.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Sheet
      title="Předávací protokol"
      subtitle={[currentJob.name, currentJob.client, currentJob.assignedGaffer && `gaffer ${currentJob.assignedGaffer}`].filter(Boolean).join(' · ')}
      onClose={handleClose}
      dismissOnBackdrop={false}
      wide
      footer={<SheetButtons onCancel={handleClose} cancelLabel="Zavřít" onSubmit={handleDownloadPDF} disabled={isGenerating} submitLabel={isGenerating ? 'Vytvářím PDF…' : 'Stáhnout PDF'} icon={Download} />}
    >
        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3 bg-surface-container p-3.5 rounded-xl border border-outline-variant text-center font-mono">
          <div>
            <span className="text-xs text-on-surface-variant block">Celkem</span>
            <span className="text-base font-bold text-on-surface">
              {jobItems.reduce((sum, i) => sum + i.quantityRequested, 0)} ks
            </span>
          </div>
          <div>
            <span className="text-xs text-on-surface-variant block">Naloženo</span>
            <span className="text-base font-bold text-secondary">
              {jobItems.reduce((sum, i) => sum + i.quantityLoaded, 0)} ks
            </span>
          </div>
          <div>
            <span className="text-xs text-on-surface-variant block">Závady</span>
            <span className="text-base font-bold text-error">
              {jobItems.filter(i => i.status === 'DAMAGED').length} ks
            </span>
          </div>
        </div>

        {/* Digital Canvas Signatures */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gaffer signature */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm text-on-surface-variant">
              <span className="font-bold text-on-surface">Podpis gaffera</span>
              <button
                type="button"
                onClick={clearCanvas(canvasGafferRef, setGafferHasSigned)}
                className="h-11 px-2 -mr-2 text-on-surface-variant flex items-center gap-1.5"
              >
                <Eraser className="w-4 h-4" /> Vymazat
              </button>
            </div>
            <div className="border border-outline-variant rounded-xl bg-white overflow-hidden relative">
              <canvas
                ref={canvasGafferRef}
                width={260}
                height={100}
                className="w-full h-28 touch-none cursor-crosshair"
                onMouseDown={startDrawing(canvasGafferRef, setIsDrawingGaffer, setGafferHasSigned)}
                onMouseMove={draw(canvasGafferRef, isDrawingGaffer)}
                onMouseUp={stopDrawing(setIsDrawingGaffer)}
                onMouseLeave={stopDrawing(setIsDrawingGaffer)}
                onTouchStart={startDrawing(canvasGafferRef, setIsDrawingGaffer, setGafferHasSigned)}
                onTouchMove={draw(canvasGafferRef, isDrawingGaffer)}
                onTouchEnd={stopDrawing(setIsDrawingGaffer)}
              />
              {!gafferHasSigned && (
                <span className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 pointer-events-none">
                  Podepište se zde
                </span>
              )}
            </div>
          </div>

          {/* Custodian signature */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm text-on-surface-variant">
              <span className="font-bold text-on-surface">Podpis skladníka</span>
              <button
                type="button"
                onClick={clearCanvas(canvasCustodianRef, setCustodianHasSigned)}
                className="h-11 px-2 -mr-2 text-on-surface-variant flex items-center gap-1.5"
              >
                <Eraser className="w-4 h-4" /> Vymazat
              </button>
            </div>
            <div className="border border-outline-variant rounded-xl bg-white overflow-hidden relative">
              <canvas
                ref={canvasCustodianRef}
                width={260}
                height={100}
                className="w-full h-28 touch-none cursor-crosshair"
                onMouseDown={startDrawing(canvasCustodianRef, setIsDrawingCustodian, setCustodianHasSigned)}
                onMouseMove={draw(canvasCustodianRef, isDrawingCustodian)}
                onMouseUp={stopDrawing(setIsDrawingCustodian)}
                onMouseLeave={stopDrawing(setIsDrawingCustodian)}
                onTouchStart={startDrawing(canvasCustodianRef, setIsDrawingCustodian, setCustodianHasSigned)}
                onTouchMove={draw(canvasCustodianRef, isDrawingCustodian)}
                onTouchEnd={stopDrawing(setIsDrawingCustodian)}
              />
              {!custodianHasSigned && (
                <span className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 pointer-events-none">
                  Podepište se zde
                </span>
              )}
            </div>
          </div>
        </div>

        {pdfError && (
          <p className="text-sm text-error font-semibold bg-error-container/20 border border-error/30 rounded-xl p-3">{pdfError}</p>
        )}

    </Sheet>
  );
};
