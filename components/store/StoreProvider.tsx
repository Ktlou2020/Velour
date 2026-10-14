'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { setCartOwner } from '@/lib/store/cart-client';

export interface StoreClientSettings {
  shippingCents: number;
  freeShippingOverCents: number;
  discreetSender: string;
}

interface StoreContextValue {
  userId: string;
  settings: StoreClientSettings;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// useLayoutEffect warns during SSR; this runs it only in the browser.
const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect;

export default function StoreProvider({ userId, settings, children }: { userId: string; settings: StoreClientSettings; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  useIsoLayoutEffect(() => { setCartOwner(userId); }, [userId]);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const value = useMemo(() => ({ userId, settings, drawerOpen, openDrawer, closeDrawer }), [userId, settings, drawerOpen, openDrawer, closeDrawer]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
