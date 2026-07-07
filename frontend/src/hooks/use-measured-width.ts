import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Track an element's rendered width via `ResizeObserver`. Used to scale each
 * preview iframe responsively to whatever width its grid cell gets.
 *
 * @returns a ref to attach to the element, and its current content-box width.
 */
export function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0;
      setWidth(measured);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
