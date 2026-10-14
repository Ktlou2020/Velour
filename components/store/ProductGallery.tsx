'use client';

import { useState } from 'react';
import ProtectedImage from '@/components/ProtectedImage';
import ProductPlaceholder from './ProductPlaceholder';

export default function ProductGallery({ images, name, category }: { images: string[]; name: string; category: string | null }) {
  const [active, setActive] = useState(0);
  if (!images.length) {
    return (
      <div className="aspect-square rounded-3xl overflow-hidden border border-white/10">
        <ProductPlaceholder name={name} category={category} size="lg" />
      </div>
    );
  }
  return (
    <div>
      <div className="aspect-square rounded-3xl overflow-hidden border border-white/10 bg-white/[0.02]">
        <ProtectedImage key={images[active]} src={images[active]} alt={`${name}, photo ${active + 1} of ${images.length}`} className="w-full h-full" loading="eager" />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 mt-3 overflow-x-auto pb-1" aria-label="Product photos">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <button type="button" onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === active}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-colors ${i === active ? 'border-[#DC143C]' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                <ProtectedImage src={`${src}?size=thumb`} alt="" className="w-full h-full" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
