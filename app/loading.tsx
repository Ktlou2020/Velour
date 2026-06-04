export default function Loading() {
  return (
    <div className="fixed inset-0 bg-[#0A0A0F] flex items-center justify-center z-50">
      <div className="relative flex items-center justify-center">
        {/* Spinning ring */}
        <div
          className="absolute w-20 h-20 rounded-full border-2 border-transparent animate-spin"
          style={{
            borderTopColor: '#DC143C',
            borderRightColor: 'rgba(220,20,60,0.3)',
          }}
        />
        {/* Inner glow ring */}
        <div
          className="absolute w-16 h-16 rounded-full border border-transparent"
          style={{ borderTopColor: 'rgba(220,20,60,0.2)' }}
        />
        {/* Logo */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#DC143C] to-[#8F0D25] flex items-center justify-center shadow-lg shadow-[#DC143C]/30">
          <span className="text-white font-bold text-2xl font-serif select-none">V</span>
        </div>
      </div>
    </div>
  );
}
