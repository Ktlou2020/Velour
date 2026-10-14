import { Heart } from 'lucide-react';

/** Big heart that pops over a photo after a double-tap like. Remount (change `key`) to replay. */
export default function HeartBurst({ size = 88 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <span className="hush-heart-burst drop-shadow-[0_6px_24px_rgba(220,20,60,0.6)]">
        <Heart size={size} className="text-white fill-[#DC143C]" strokeWidth={1.5} />
      </span>
    </span>
  );
}
