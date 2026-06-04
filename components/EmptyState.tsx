import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-20 h-20 rounded-full bg-[#DC143C]/15 border border-[#DC143C]/30 flex items-center justify-center mb-6">
        <Icon size={36} className="text-[#DC143C]" />
      </div>
      <h2 className="font-serif text-2xl font-bold text-white mb-3">{title}</h2>
      <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-6">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-7 py-3 rounded-xl font-semibold text-sm transition-all"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
