import { Suspense } from 'react';
import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import GalleryManager from '@/components/gallery/GalleryManager';
import { GridSkeleton } from '@/components/gallery/ui';

export const metadata: Metadata = {
  title: 'My gallery',
  robots: { index: false, follow: false },
};

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main id="main-content" className="pt-16">
        <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-8"><GridSkeleton /></div>}>
          <GalleryManager />
        </Suspense>
      </main>
    </div>
  );
}
