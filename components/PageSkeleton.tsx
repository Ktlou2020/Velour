import MemberCardSkeleton from './MemberCardSkeleton';

/**
 * Route-level loading placeholder that mirrors the real page shape
 * (navbar height, header band, content) so nothing jumps when data arrives.
 */
export default function PageSkeleton({ variant = 'list' }: { variant?: 'grid' | 'list' | 'profile' }) {
  return (
    <div className="min-h-screen bg-[#0A0A0F]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="fixed top-0 inset-x-0 h-16 glass-dark border-b border-white/5 z-40" />
      <div className="pt-16">
        {variant === 'profile' ? (
          <div className="max-w-5xl mx-auto px-4 pt-24 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-3xl skeleton" />
              <div className="flex-1 space-y-3">
                <div className="h-8 w-48 rounded-lg skeleton" />
                <div className="h-4 w-64 max-w-full rounded skeleton" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <div className="h-12 w-40 rounded-xl skeleton" />
              <div className="h-12 w-24 rounded-xl skeleton" />
            </div>
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="md:col-span-2 space-y-4">
                <div className="h-32 rounded-2xl skeleton" />
                <div className="h-24 rounded-2xl skeleton" />
              </div>
              <div className="h-48 rounded-2xl skeleton" />
            </div>
          </div>
        ) : (
          <>
            <div className="py-8 sm:py-12 px-4 border-b border-white/5">
              <div className="max-w-6xl mx-auto space-y-3">
                <div className="h-9 w-56 rounded-lg skeleton" />
                <div className="h-4 w-80 max-w-full rounded skeleton" />
              </div>
            </div>
            <div className="max-w-6xl mx-auto px-4 py-8">
              {variant === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => <MemberCardSkeleton key={i} />)}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-5">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 rounded-2xl skeleton" />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
