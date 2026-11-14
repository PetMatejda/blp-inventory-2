// In-app dialogs that replace window.confirm / prompt / alert:
//   const { confirm, askNumber, toast } = useDialogs();
//   if (await confirm({ title, message, confirmLabel, danger })) …
//   const n = await askNumber({ title, value, max });   // null = cancelled
//   toast({ text, actionLabel: 'Vrátit', onAction })     // e.g. undo
// Bottom sheet on phones, centred card on larger screens; big touch targets.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Delete, X } from 'lucide-react';

const DialogContext = createContext(null);

export const Sheet = ({ title, subtitle, onClose, children, labelledBy = 'sheet-title' }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-card-bg border border-outline-variant rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-150"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={labelledBy} className="text-lg font-bold text-on-surface leading-snug break-words">{title}</h2>
            {subtitle && <p className="text-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Zavřít" className="w-11 h-11 -mr-2 -mt-2 shrink-0 rounded-full flex items-center justify-center text-outline hover:bg-surface-variant">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};

/** One row in an action sheet. */
export const SheetAction = ({ icon: Icon, label, hint, onClick, danger = false, disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full min-h-[52px] px-4 py-3 rounded-2xl text-left flex items-center gap-3 border transition-colors active:scale-[0.98] disabled:opacity-40 ${
      danger
        ? 'border-error/30 bg-error-container/10 text-error hover:bg-error-container/25'
        : 'border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high'
    }`}
  >
    {Icon && <Icon className="w-5 h-5 shrink-0" />}
    <span className="flex-1 min-w-0">
      <span className="block text-base font-semibold">{label}</span>
      {hint && <span className="block text-sm text-on-surface-variant font-normal">{hint}</span>}
    </span>
  </button>
);

const ConfirmDialog = ({ title, message, confirmLabel = 'Potvrdit', cancelLabel = 'Zrušit', danger, onResult }) => (
  <Sheet title={title} onClose={() => onResult(false)}>
    {message && <p className="text-base text-on-surface-variant whitespace-pre-line">{message}</p>}
    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => onResult(false)} className="h-14 rounded-2xl border border-outline-variant bg-surface-container text-on-surface text-base font-semibold">
        {cancelLabel}
      </button>
      <button
        autoFocus
        onClick={() => onResult(true)}
        className={`h-14 rounded-2xl text-base font-bold shadow ${danger ? 'bg-error text-on-error' : 'bg-secondary text-on-secondary-container'}`}
      >
        {confirmLabel}
      </button>
    </div>
  </Sheet>
);

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

const NumberDialog = ({ title, message, value = 0, max, onResult }) => {
  const [text, setText] = useState(String(value ?? ''));
  const num = text === '' ? 0 : parseInt(text, 10);
  const over = max != null && num > max;
  const press = (k) => {
    if (k === 'clear') setText('');
    else if (k === 'back') setText((t) => t.slice(0, -1));
    else setText((t) => (t === '0' ? k : (t + k).slice(0, 4)));
  };
  return (
    <Sheet title={title} subtitle={message} onClose={() => onResult(null)}>
      <div className="text-center">
        <span className="font-mono font-bold text-5xl text-primary">{text || '0'}</span>
        {max != null && <span className="font-mono text-2xl text-on-surface-variant"> / {max}</span>}
        {over && <p className="text-sm text-tertiary font-semibold mt-1">Víc než plán — požadovaný počet se navýší.</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            aria-label={k === 'back' ? 'Smazat číslici' : k === 'clear' ? 'Vymazat' : k}
            className="h-14 rounded-2xl bg-surface-container border border-outline-variant text-2xl font-bold text-on-surface active:scale-95 flex items-center justify-center"
          >
            {k === 'back' ? <Delete className="w-6 h-6" /> : k === 'clear' ? <span className="text-base">C</span> : k}
          </button>
        ))}
      </div>
      <button onClick={() => onResult(num)} className="h-14 rounded-2xl bg-secondary text-on-secondary-container text-lg font-bold shadow">
        Uložit {num} ks
      </button>
    </Sheet>
  );
};

const ToastBar = ({ toast, onClose }) => {
  if (!toast) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }} role="status">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 border border-white/10">
        <span className="flex-1 text-sm font-semibold">{toast.text}</span>
        {toast.actionLabel && (
          <button
            onClick={() => { toast.onAction?.(); onClose(); }}
            className="h-11 px-4 rounded-xl bg-white/10 text-emerald-300 text-sm font-bold uppercase tracking-wide"
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export const DialogProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null);
  const [toastState, setToastState] = useState(null);
  const toastTimer = useRef(null);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setDialog({ type: 'confirm', opts, resolve });
  }), []);

  const askNumber = useCallback((opts) => new Promise((resolve) => {
    setDialog({ type: 'number', opts, resolve });
  }), []);

  const closeToast = useCallback(() => { clearTimeout(toastTimer.current); setToastState(null); }, []);
  const toast = useCallback((opts) => {
    clearTimeout(toastTimer.current);
    setToastState(opts);
    toastTimer.current = setTimeout(() => setToastState(null), opts.ms ?? (opts.actionLabel ? 6000 : 3500));
  }, []);

  const finish = (value) => { dialog?.resolve(value); setDialog(null); };

  return (
    <DialogContext.Provider value={{ confirm, askNumber, toast }}>
      {children}
      {dialog?.type === 'confirm' && <ConfirmDialog {...dialog.opts} onResult={finish} />}
      {dialog?.type === 'number' && <NumberDialog {...dialog.opts} onResult={finish} />}
      <ToastBar toast={toastState} onClose={closeToast} />
    </DialogContext.Provider>
  );
};

export const useDialogs = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>');
  return ctx;
};
