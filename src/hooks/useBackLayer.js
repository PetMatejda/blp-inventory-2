// Android / browser Back button support.
//
// Every open overlay (sheet, drawer, scanner, a tab other than the home tab)
// registers a "layer". Each layer owns one browser-history entry, so Back
// closes the top layer instead of leaving the app:
//   useBackLayer(isOpen, close)
// Closing a layer from the UI removes its history entry again.
import { useEffect, useRef } from 'react';

const stack = [];
let ignorePops = 0;
let listening = false;

const onPopState = () => {
  if (ignorePops > 0) { ignorePops -= 1; return; }
  const top = stack.pop();
  if (top) top.close();
};

const pushLayer = (close) => {
  if (!listening) {
    window.addEventListener('popstate', onPopState);
    listening = true;
  }
  const entry = { close };
  stack.push(entry);
  window.history.pushState({ blpLayer: stack.length }, '');
  return () => {
    const i = stack.indexOf(entry);
    if (i === -1) return; // already closed by Back
    stack.splice(i, 1);
    ignorePops += 1;
    window.history.back();
  };
};

export const useBackLayer = (active, onClose) => {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    return pushLayer(() => closeRef.current?.());
  }, [active]);
};
