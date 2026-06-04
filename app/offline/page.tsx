'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#DC143C]/30">
          <span className="text-white font-bold text-4xl font-serif">V</span>
        </div>
        <h1 className="text-white text-2xl font-bold font-serif mb-3">You&apos;re Offline</h1>
        <p className="text-white/40 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
          It looks like you&apos;ve lost your connection. Check your internet and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3 rounded-xl font-semibold text-sm transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
