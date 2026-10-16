import { Suspense } from 'react';
import type { Metadata } from 'next';
import UnsubscribeContent from './UnsubscribeContent';

export const metadata: Metadata = { title: 'Email preferences', robots: { index: false, follow: false } };

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
