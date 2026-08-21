import { useRef, useCallback } from 'react';

export const useLongPress = (onLongPress, onClick, { delay = 500 } = {}) => {
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const isMovedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const start = useCallback(
    (e) => {
      isLongPressRef.current = false;
      isMovedRef.current = false;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startPosRef.current = { x: clientX, y: clientY };

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        if (onLongPress) onLongPress(e);
      }, delay);
    },
    [onLongPress, delay]
  );

  const move = useCallback((e) => {
    if (!startPosRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = Math.abs(clientX - startPosRef.current.x);
    const dy = Math.abs(clientY - startPosRef.current.y);

    // If drag/scroll exceeds 8px, cancel long press AND prevent click
    if (dx > 8 || dy > 8) {
      isMovedRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const clear = useCallback(
    (e, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (shouldTriggerClick && !isLongPressRef.current && !isMovedRef.current && onClick) {
        onClick(e);
      }
    },
    [onClick]
  );

  const cancelLongPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: (e) => start(e),
    onMouseMove: (e) => move(e),
    onMouseUp: (e) => clear(e, true),
    onMouseLeave: (e) => clear(e, false),
    onTouchStart: (e) => start(e),
    onTouchMove: (e) => move(e),
    onTouchEnd: (e) => clear(e, true),
    cancelLongPress,
  };
};
