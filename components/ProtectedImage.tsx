'use client';

import { useRef } from 'react';

interface Props {
  src: string;
  alt: string;
  className?: string;
  watermark?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a user photo with download/save protections:
 * - Right-click disabled
 * - Drag disabled
 * - Touch-hold save blocked (touch-action: none on overlay)
 * - Pointer events captured by overlay so img is never directly interactable
 * - Semi-transparent watermark burned into the view (not the file)
 */
export default function ProtectedImage({ src, alt, className, watermark, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  function block(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${className ?? ''}`}
      style={{ WebkitUserSelect: 'none', userSelect: 'none', ...style }}
      onContextMenu={block}
      onDragStart={block}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover pointer-events-none"
        style={{
          WebkitUserDrag: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        } as React.CSSProperties}
        draggable={false}
        onContextMenu={block}
        onDragStart={block}
      />

      {/* Transparent overlay — captures all pointer events so the img can't be right-clicked or dragged */}
      <div
        className="absolute inset-0"
        style={{ touchAction: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
        onContextMenu={block}
        onDragStart={block}
      />

      {/* Watermark grid */}
      {watermark && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
          style={{ touchAction: 'none' } as React.CSSProperties}
        >
          {/* Repeated diagonal watermark pattern */}
          <div
            className="absolute inset-0 flex flex-wrap content-start gap-x-8 gap-y-6 p-2 rotate-[-30deg] scale-[1.6] origin-center"
          >
            {Array.from({ length: 30 }).map((_, i) => (
              <span
                key={i}
                className="text-white/[0.07] text-[10px] font-semibold tracking-widest uppercase whitespace-nowrap select-none"
              >
                {watermark}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
