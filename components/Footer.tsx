import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#060609] border-t border-white/5 py-16 px-4" role="contentinfo">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4" aria-label="Velour home">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-crimson-500 to-crimson-700 flex items-center justify-center">
                <span className="text-white font-bold text-lg font-serif">V</span>
              </div>
              <span className="text-white font-bold text-xl tracking-widest">VELOUR</span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              Where Connections Become Extraordinary. The world&apos;s most refined lifestyle dating community for discerning adults.
            </p>
            <div className="flex gap-3 mt-6">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="w-9 h-9 glass rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-all text-xs font-bold">T</a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 glass rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-all text-xs font-bold">In</a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-9 h-9 glass rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-all text-xs font-bold">F</a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-widest">Company</h4>
            <ul className="space-y-2">
              {[
                { label: 'About', href: '/about' },
                { label: 'Blog', href: '/blog' },
                { label: 'Careers', href: '/careers' },
                { label: 'Press', href: '/press' },
                { label: 'Contact', href: '/contact' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-white/40 hover:text-white text-sm transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-widest">Legal</h4>
            <ul className="space-y-2">
              {[
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Cookie Policy', href: '/cookies' },
                { label: 'Safety Center', href: '/safety' },
                { label: 'DMCA', href: '/dmca' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-white/40 hover:text-white text-sm transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="section-divider mb-6" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">© 2025 Velour. All rights reserved. 18+ only.</p>
          <p className="text-white/20 text-xs text-center md:text-right">This site is intended for adults aged 18 and over. By using this site you agree to our Terms of Service.</p>
        </div>
      </div>
    </footer>
  );
}
