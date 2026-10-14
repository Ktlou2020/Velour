import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface Action {
  label: string;
  href: string;
}

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: Action;
  secondaryAction?: Action;
  /** Smaller vertical padding for use inside cards / side panels. */
  compact?: boolean;
}

export default function EmptyState({ icon: Icon, title, description, action, secondaryAction, compact = false }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 ${compact ? 'py-10' : 'py-16 sm:py-20'}`}>
      <div className="relative mb-6">
        <div aria-hidden="true" className="absolute inset-0 rounded-full bg-[#DC143C]/20 blur-2xl" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#DC143C]/20 to-[#D4AF37]/10 border border-white/10 flex items-center justify-center">
          <Icon size={32} className="text-[#FF4D6D]" aria-hidden="true" />
        </div>
      </div>
      <h2 className="font-serif text-2xl font-bold text-white mb-2 text-balance">{title}</h2>
      <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-sm mb-7">{description}</p>
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action && (
            <Link
              href={action.href}
              className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-7 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-[#DC143C]/20"
            >
              {action.label}
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="glass border border-white/15 hover:border-white/30 text-white/85 hover:text-white px-6 py-3 rounded-xl font-medium text-sm transition-all"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
