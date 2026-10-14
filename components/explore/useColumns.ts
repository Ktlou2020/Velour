'use client';

import { useEffect, useState } from 'react';

/** 2 columns on phones, 3 on tablets, 4 on desktops. */
export function useColumns(): number {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const md = window.matchMedia('(min-width: 768px)');
    const xl = window.matchMedia('(min-width: 1180px)');
    const update = () => setCols(xl.matches ? 4 : md.matches ? 3 : 2);
    update();
    md.addEventListener('change', update);
    xl.addEventListener('change', update);
    return () => { md.removeEventListener('change', update); xl.removeEventListener('change', update); };
  }, []);
  return cols;
}

/** Deterministic tile shape per photo: roughly one in three is tall. */
export function tileRatio(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 3 === 0 ? 1.3 : 1;
}

/**
 * Greedy masonry: each item goes to the currently shortest column, so the
 * reading order stays close to the ranking (left→right, top→bottom) and items
 * already placed never move when more are appended.
 */
export function distribute<T extends { id: string }>(items: T[], cols: number): { item: T; index: number }[][] {
  const out: { item: T; index: number }[][] = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  items.forEach((item, index) => {
    let c = 0;
    for (let i = 1; i < cols; i++) if (heights[i] < heights[c] - 0.01) c = i;
    out[c].push({ item, index });
    heights[c] += tileRatio(item.id) + 0.32; // + caption strip
  });
  return out;
}
