import ProtectedImage from '@/components/ProtectedImage';

const GRADIENTS = ['from-rose-900 to-red-800', 'from-violet-900 to-purple-700', 'from-emerald-900 to-teal-700', 'from-amber-900 to-orange-800', 'from-blue-900 to-cyan-800'];

export default function PersonAvatar({ name, photo, size = 44, seed }: { name: string; photo: string | null; size?: number; seed?: string }) {
  const g = GRADIENTS[(seed || name || '?').charCodeAt(0) % GRADIENTS.length];
  return (
    <div
      className={`rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br ${g} flex items-center justify-center border border-white/10`}
      style={{ width: size, height: size }}
    >
      {photo
        ? <ProtectedImage src={photo} alt="" className="w-full h-full" watermark="" />
        : <span className="text-white/90 font-bold font-serif" style={{ fontSize: size * 0.38 }}>{(name || '?').slice(0, 1).toUpperCase()}</span>}
    </div>
  );
}
