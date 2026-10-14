import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Curated member events and meetups.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
