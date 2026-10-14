'use client';

import { Minus, Plus } from 'lucide-react';

interface Props {
  value: number;
  max: number;
  min?: number;
  onChange: (n: number) => void;
  label: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export default function QuantityStepper({ value, max, min = 1, onChange, label, size = 'md', disabled }: Props) {
  const btn = size === 'sm' ? 'w-8 h-8' : 'w-11 h-11';
  return (
    <div className="inline-flex items-center rounded-xl border border-white/12 bg-white/5" role="group" aria-label={label}>
      <button type="button" className={`${btn} flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30`}
        onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Minus size={size === 'sm' ? 14 : 16} />
      </button>
      <span className={`${size === 'sm' ? 'w-7 text-sm' : 'w-9'} text-center text-white tabular-nums`} aria-live="polite">{value}</span>
      <button type="button" className={`${btn} flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30`}
        onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus size={size === 'sm' ? 14 : 16} />
      </button>
    </div>
  );
}
