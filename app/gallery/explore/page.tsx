import { Suspense } from 'react';
import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import ExploreFeed from '@/components/explore/ExploreFeed';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Discover and like photos members have chosen to share publicly.',
  robots: { index: false, follow: false },
};

// Logged-in members only: /gallery/** is protected by middleware.
export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main id="main-content" className="pt-16">
        <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-10" aria-hidden="true"><div className="h-10 w-40 rounded-xl skeleton" /></div>}>
          <ExploreFeed />
        </Suspense>
      </main>
    </div>
  );
}
