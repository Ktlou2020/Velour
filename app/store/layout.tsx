import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/store/CartDrawer';
import StoreHeader from '@/components/store/StoreHeader';
import StoreLegalNote from '@/components/store/StoreLegalNote';
import StoreProvider from '@/components/store/StoreProvider';
import { STORE_NAME, STORE_TAGLINE } from '@/lib/store/config';
import { storeSettings } from '@/lib/store/settings';

export const metadata: Metadata = {
  title: { default: STORE_NAME, template: `%s · ${STORE_NAME}` },
  description: STORE_TAGLINE,
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/signin');
  const settings = storeSettings();

  return (
    <StoreProvider userId={userId} settings={settings}>
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
        <Navbar />
        <div className="pt-16">
          <Suspense fallback={<div className="h-14 border-b border-white/5" />}>
            <StoreHeader />
          </Suspense>
        </div>
        <main className="flex-1">{children}</main>
        <StoreLegalNote discreetSender={settings.discreetSender} />
        <Footer />
      </div>
      <CartDrawer />
    </StoreProvider>
  );
}
