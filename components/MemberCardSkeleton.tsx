export default function MemberCardSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      {/* Photo area */}
      <div className="relative aspect-[3/4] bg-white/5">
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'velour-shimmer 1.6s infinite',
          }}
        />
        {/* Bottom text placeholders */}
        <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
          <div className="h-3 w-3/4 rounded bg-white/10" />
          <div className="h-2.5 w-1/2 rounded bg-white/10" />
          <div className="h-2 w-1/3 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}
