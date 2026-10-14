import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join free',
  description: 'Create your free Hush profile — for singles and couples, 18+.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
