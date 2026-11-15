// True while the user scrolls down the page (secondary toolbars can hide to
// give the list more room); false again on scrolling up or near the top.
import { useEffect, useRef, useState } from 'react';

export const useHideOnScroll = ({ enabled = true, offset = 160, delta = 12 } = {}) => {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const lockedUntil = useRef(0);

  useEffect(() => {
    if (!enabled) { setHidden(false); return undefined; }
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const now = Date.now();
      // Hiding changes the page height; ignore the scroll events that causes.
      if (now < lockedUntil.current) { lastY.current = y; return; }
      const diff = y - lastY.current;
      if (Math.abs(diff) < delta && y > offset) return;
      const next = y > offset && diff > 0;
      lastY.current = y;
      setHidden((prev) => {
        if (prev !== next) lockedUntil.current = now + 350;
        return next;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled, offset, delta]);

  return hidden;
};
