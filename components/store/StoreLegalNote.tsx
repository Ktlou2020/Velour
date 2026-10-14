import Link from 'next/link';
import { Lock, Package, RotateCcw, ShieldCheck } from 'lucide-react';
import { STORE_NAME, STORE_TERMS_HREF } from '@/lib/store/config';

/** Compliance strip shown at the bottom of every store page. */
export default function StoreLegalNote({ discreetSender }: { discreetSender: string }) {
  const items = [
    { icon: ShieldCheck, title: '18+ only', body: `${STORE_NAME} sells adult products to verified members aged 18 and over.` },
    { icon: Package, title: 'Discreet delivery', body: `Plain, unbranded packaging. The sender shows as “${discreetSender}”. South Africa only.` },
    { icon: RotateCcw, title: 'Returns', body: 'Intimate products: unopened and sealed only. Defective goods: within 6 months (Consumer Protection Act).' },
    { icon: Lock, title: 'Private by design', body: 'Prices include 15% VAT. Your order details are protected under POPIA and never shared for marketing.' },
  ];
  return (
    <section aria-label={`${STORE_NAME} policies`} className="border-t border-white/5 bg-[#08080C] mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon size={18} className="text-[#D4AF37] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-white text-sm font-semibold">{title}</p>
                <p className="text-white/55 text-xs leading-relaxed mt-1">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-white/40 text-xs mt-8">
          Full details in the <Link href={STORE_TERMS_HREF} className="text-[#FF4D6D] hover:underline">{STORE_NAME} store terms</Link>.
        </p>
      </div>
    </section>
  );
}
