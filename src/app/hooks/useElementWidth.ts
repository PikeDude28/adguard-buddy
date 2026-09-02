"use client";

import { useEffect, useRef, useState } from 'react';

/**
 * Tracks an element's content width so charts can be drawn in real pixel
 * coordinates. Drawing in pixels (rather than a stretched viewBox) keeps stroke
 * widths and text from being distorted, and makes hover hit-testing exact.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => setWidth(element.clientWidth || fallback);
    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallback]);

  return { ref, width };
}
