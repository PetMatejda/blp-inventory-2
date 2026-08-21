import React, { useRef, useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { pdfService } from '../../services/pdfService';
import { FileText, Download, X, Eraser, Check } from 'lucide-react';

export const ProtocolModal = () => {
  const { isProtocolModalOpen, setIsProtocolModalOpen, currentJob, jobItems, vehicles, userRole } = useInventory();

  const canvasGafferRef = useRef(null);
  const canvasCustodianRef = useRef(null);

  const [isDrawingGaffer, setIsDrawingGaffer] = useState(false);
  const [isDrawingCustodian, setIsDrawingCustodian] = useState(false);
  const [gafferHasSigned, setGafferHasSigned] = useState(false);
  const [custodianHasSigned, setCustodianHasSigned] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isProtocolModalOpen || !currentJob) return null;

  // Simple Canvas Drawing handlers
  const startDrawing = (canvasRef, setDrawingState, setSignedState) => (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

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
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

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

    const gafferData = gafferHasSigned && canvasGafferRef.current ? canvasGafferRef.current.toDataURL() : null;
    const custodianData = custodianHasSigned && canvasCustodianRef.current ? canvasCustodianRef.current.toDataURL() : null;

    await pdfService.generateHandoverProtocolPDF(
      currentJob,
      jobItems,
      vehicles,
      userRole,
      gafferData,
      custodianData
    );

    setIsGenerating(false);
    setIsProtocolModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-outline-variant max-w-2xl w-full p-6 flex flex-col gap-5 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest flex items-center gap-1">
              <FileText className="w-4 h-4" /> GENERÁTOR PŘEDÁVACÍHO PROTOKOLU
            </span>
            <h2 className="text-xl font-bold text-on-surface mt-1">{currentJob.name}</h2>
            <p className="text-xs text-outline font-mono">Klient: {currentJob.client} • Gaffer: {currentJob.assignedGaffer}</p>
          </div>
          <button
            onClick={() => setIsProtocolModalOpen(false)}
            className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3 bg-surface-container p-3.5 rounded-xl border border-outline-variant text-center font-mono">
          <div>
            <span className="text-[10px] text-outline uppercase block">Celkem Kusů</span>
            <span className="text-base font-bold text-on-surface">
              {jobItems.reduce((sum, i) => sum + i.quantityRequested, 0)} ks
            </span>
          </div>
          <div>
            <span className="text-[10px] text-outline uppercase block">Naloženo</span>
            <span className="text-base font-bold text-secondary">
              {jobItems.reduce((sum, i) => sum + i.quantityLoaded, 0)} ks
            </span>
          </div>
          <div>
            <span className="text-[10px] text-outline uppercase block">Závady</span>
            <span className="text-base font-bold text-error">
              {jobItems.filter(i => i.status === 'DAMAGED').length} ks
            </span>
          </div>
        </div>

        {/* Digital Canvas Signatures */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gaffer signature */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-mono text-outline">
              <span className="font-bold text-on-surface">Podpis Lead Gaffera:</span>
              <button
                type="button"
                onClick={clearCanvas(canvasGafferRef, setGafferHasSigned)}
                className="text-outline hover:text-error flex items-center gap-1"
              >
                <Eraser className="w-3 h-3" /> Vymazat
              </button>
            </div>
            <div className="border border-outline-variant rounded-xl bg-white overflow-hidden relative">
              <canvas
                ref={canvasGafferRef}
                width={260}
                height={100}
                className="w-full h-24 touch-none cursor-crosshair"
                onMouseDown={startDrawing(canvasGafferRef, setIsDrawingGaffer, setGafferHasSigned)}
                onMouseMove={draw(canvasGafferRef, isDrawingGaffer)}
                onMouseUp={stopDrawing(setIsDrawingGaffer)}
                onMouseLeave={stopDrawing(setIsDrawingGaffer)}
                onTouchStart={startDrawing(canvasGafferRef, setIsDrawingGaffer, setGafferHasSigned)}
                onTouchMove={draw(canvasGafferRef, isDrawingGaffer)}
                onTouchEnd={stopDrawing(setIsDrawingGaffer)}
              />
              {!gafferHasSigned && (
                <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none italic">
                  Podepište se zde (Lead Gaffer)
                </span>
              )}
            </div>
          </div>

          {/* Custodian signature */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-mono text-outline">
              <span className="font-bold text-on-surface">Podpis Skladníka (Custodian):</span>
              <button
                type="button"
                onClick={clearCanvas(canvasCustodianRef, setCustodianHasSigned)}
                className="text-outline hover:text-error flex items-center gap-1"
              >
                <Eraser className="w-3 h-3" /> Vymazat
              </button>
            </div>
            <div className="border border-outline-variant rounded-xl bg-white overflow-hidden relative">
              <canvas
                ref={canvasCustodianRef}
                width={260}
                height={100}
                className="w-full h-24 touch-none cursor-crosshair"
                onMouseDown={startDrawing(canvasCustodianRef, setIsDrawingCustodian, setCustodianHasSigned)}
                onMouseMove={draw(canvasCustodianRef, isDrawingCustodian)}
                onMouseUp={stopDrawing(setIsDrawingCustodian)}
                onMouseLeave={stopDrawing(setIsDrawingCustodian)}
                onTouchStart={startDrawing(canvasCustodianRef, setIsDrawingCustodian, setCustodianHasSigned)}
                onTouchMove={draw(canvasCustodianRef, isDrawingCustodian)}
                onTouchEnd={stopDrawing(setIsDrawingCustodian)}
              />
              {!custodianHasSigned && (
                <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none italic">
                  Podepište se zde (Rental Custodian)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => setIsProtocolModalOpen(false)}
            className="flex-1 py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
          >
            Zavřít
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="flex-1 py-3 bg-primary text-on-primary-container font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" /> {isGenerating ? 'Generování PDF...' : 'Stáhnout PDF Protokol'}
          </button>
        </div>
      </div>
    </div>
  );
};
