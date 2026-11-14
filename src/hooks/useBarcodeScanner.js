// Hardware barcode / QR readers (USB or Bluetooth) behave like a keyboard: they
// "type" the code very fast and press Enter. This hook recognises such a burst
// anywhere on the screen — no need to tap into a text field first.
import { useEffect, useRef } from 'react';

/**
 * Pure burst detector (testable). Keys arriving faster than maxInterval ms
 * form one scan; Enter (or Tab) finishes it. Slow typing by a person resets it.
 */
export function createScanBuffer({ maxInterval = 60, minLength = 3 } = {}) {
  let chars = '';
  let last = 0;
  return {
    push(key, time) {
      if (key === 'Enter' || key === 'Tab') {
        const code = chars;
        chars = '';
        return code.length >= minLength ? code : null;
      }
      if (key.length !== 1) return null; // Shift, arrows…
      if (chars && time - last > maxInterval) chars = '';
      chars += key;
      last = time;
      return null;
    },
    reset() { chars = ''; },
  };
}

const isTypingTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

/**
 * Calls onScan(code) for every code from a hardware reader while `enabled`.
 * Ignored while the user types into a field (the field gets the code instead)
 * and while a dialog is open.
 */
export function useBarcodeScanner(onScan, { enabled = true } = {}) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return undefined;
    const buffer = createScanBuffer();
    const onKey = (e) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) { buffer.reset(); return; }
      if (document.querySelector('[role=dialog]')) { buffer.reset(); return; }
      const code = buffer.push(e.key, e.timeStamp || performance.now());
      if (code) {
        e.preventDefault();
        onScanRef.current(code);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
