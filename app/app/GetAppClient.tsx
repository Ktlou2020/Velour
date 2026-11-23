'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Zap, EyeOff, Smartphone, Wifi } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import InstallSteps from '@/components/app/InstallSteps';
import { INSTALL_AVAILABLE_EVENT, installMethod, isAndroid, isIOS, type InstallMethod } from '@/lib/pwa-client';

const BENEFITS = [
  { icon: Bell, title: 'Never miss a message', text: 'Alerts when someone messages or matches with you — even when Unbound is closed.' },
  { icon: Zap, title: 'One tap to open', text: 'Full-screen from your home screen, no address bar, no logging in every time.' },
  { icon: EyeOff, title: 'Discreet', text: 'Turn on discreet alerts and your lock screen just says “New notification”.' },
  { icon: Wifi, title: 'Light on data', text: 'No download from an app store and almost no storage — it updates itself.' },
];

/** /app — "Get the Unbound app": the right steps for this device, a QR code on computers. */
export default function GetAppClient({ qrSvg }: { qrSvg: string }) {
  const [method, setMethod] = useState<InstallMethod | null>(null);
  const [tab, setTab] = useState<'iphone' | 'android'>('iphone');

  useEffect(() => {
    const update = () => setMethod(installMethod());
    update();
    setTab(isAndroid() ? 'android' : 'iphone');
    window.addEventListener(INSTALL_AVAILABLE_EVENT, update);
    return () => window.removeEventListener(INSTALL_AVAILABLE_EVENT, update);
  }, []);

  const onPhone = method !== null && method !== 'desktop';

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex mb-4"><LogoMark size="lg" /></div>
        <h1 className="text-white text-3xl sm:text-4xl font-bold font-serif">Get the Unbound app</h1>
        <p className="text-white/60 mt-2 max-w-lg mx-auto">Free, no app store needed. Add Unbound to your home screen in a few seconds.</p>
      </div>

      <section aria-labelledby="install-h" className="glass rounded-3xl p-6 sm:p-8 mb-6">
        <h2 id="install-h" className="text-white font-semibold text-lg mb-4 flex items-center gap-2"><Smartphone size={18} className="text-[#FF4D6D]" aria-hidden="true" />
          {method === 'installed' ? 'You’re all set' : onPhone ? 'Add it to this phone' : 'Open this page on your phone'}
        </h2>
        {method === null ? (
          <div className="h-16 rounded-xl skeleton" aria-hidden="true" />
        ) : onPhone ? (
          <>
            <InstallSteps method={method} />
            {method === 'installed' && <p className="text-white/55 text-sm mt-3">Turn on alerts in <Link href="/account#app" className="text-[#FF4D6D] hover:underline">Settings → App &amp; notifications</Link>.</p>}
          </>
        ) : (
          <div className="grid sm:grid-cols-[auto_1fr] gap-6 items-center">
            <div className="mx-auto w-44 h-44 rounded-2xl bg-white p-2" role="img" aria-label="QR code to open unboundza.com/app on your phone" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div>
              <p className="text-white/75 text-sm mb-4">Scan with your phone&apos;s camera, or go to <strong className="text-white">unboundza.com/app</strong>, then follow the steps for your phone:</p>
              <div role="tablist" aria-label="Phone type" className="inline-flex rounded-full border border-white/10 p-1 mb-4">
                {(['iphone', 'android'] as const).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-4 h-8 rounded-full text-sm ${tab === t ? 'bg-white text-[#0A0A0F] font-semibold' : 'text-white/70 hover:text-white'}`}>
                    {t === 'iphone' ? 'iPhone' : 'Android'}
                  </button>
                ))}
              </div>
              <InstallSteps method={tab === 'iphone' ? 'ios-safari' : 'android-menu'} />
            </div>
          </div>
        )}
        {onPhone && method !== 'installed' && isIOS() && (
          <p className="text-white/50 text-xs mt-4">On iPhone, message alerts only work once Unbound is on your home screen.</p>
        )}
      </section>

      <ul className="grid sm:grid-cols-2 gap-3">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="glass rounded-2xl p-5">
            <Icon size={18} className="text-[#FF4D6D] mb-2" aria-hidden="true" />
            <p className="text-white font-semibold text-sm">{title}</p>
            <p className="text-white/60 text-sm mt-1 leading-relaxed">{text}</p>
          </li>
        ))}
      </ul>

      <p className="text-center text-white/60 text-sm mt-8">
        Questions? See the <Link href="/help" className="text-[#FF4D6D] underline">Help Centre</Link>.
      </p>
    </div>
  );
}
