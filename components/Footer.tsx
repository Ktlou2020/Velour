import Link from 'next/link';
import Logo from './Logo';
import { BUSINESS } from '@/lib/business';

const COLUMNS = [
  {
    heading: 'Hush',
    links: [
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Join free', href: '/auth/signup' },
      { label: 'Sign in', href: '/auth/signin' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { label: 'Contact us', href: '/contact' },
      { label: 'Safety Centre', href: '/safety' },
      { label: 'Shipping & delivery', href: '/shipping' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Refund & cancellation', href: '/refunds' },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#060609] border-t border-white/5 pt-14 pb-10 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-10 grid-cols-2 md:grid-cols-5 mb-12">
          <div className="col-span-2">
            <Logo className="mb-4" />
            <p className="text-white/60 text-sm leading-relaxed max-w-sm">
              A private, members-first dating community for singles and couples. Discreet by design, made in South Africa.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-white/90 font-semibold text-xs mb-4 uppercase tracking-[0.18em]">{col.heading}</h2>
              <ul className="space-y-2.5">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-white/60 hover:text-white text-sm transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="section-divider mb-6" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <p className="text-white/60 text-sm">
            © {year} {BUSINESS.legalName ? `${BUSINESS.legalName} t/a ${BUSINESS.tradingName}` : BUSINESS.tradingName}
            {BUSINESS.registrationNumber ? ` · Reg. ${BUSINESS.registrationNumber}` : ''}. Strictly 18+.
          </p>
          <p className="text-white/65 text-xs max-w-md md:text-right">
            By using Hush you agree to our <Link href="/terms" className="underline hover:text-white">Terms of Service</Link> and confirm you are 18 or older.
          </p>
        </div>
      </div>
    </footer>
  );
}
