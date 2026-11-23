import type { Metadata } from 'next';
import QRCode from 'qrcode';
import Navbar from '@/components/Navbar';
import { SITE_URL } from '@/app/site';
import GetAppClient from './GetAppClient';

export const metadata: Metadata = {
  title: 'Get the app',
  description: 'Add Unbound to your phone’s home screen — free, no app store. Message and match alerts, one tap to open.',
  alternates: { canonical: '/app' },
};

export default async function GetAppPage() {
  const url = `${SITE_URL.replace(/\/$/, '')}/app`;
  const qr = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#0A0A0F', light: '#FFFFFF' } });
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main id="main-content" className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        <GetAppClient qrSvg={qr} />
      </main>
    </div>
  );
}
