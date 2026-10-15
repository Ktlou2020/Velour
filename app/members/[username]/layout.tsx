import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Member profile · Unbound' },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
