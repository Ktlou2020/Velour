import type { ActiveStatus } from './status';

interface Props {
  status: Pick<ActiveStatus, 'emoji' | 'text'> | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * A member's current status, e.g. "🍷 Free tonight". Render it only for an
 * active (unexpired) status — use activeStatus() from ./status on the server.
 */
export default function StatusPill({ status, size = 'md', className = '' }: Props) {
  if (!status?.text) return null;
  const sz = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-sm px-3 py-1 gap-1.5';
  return (
    <span
      className={`inline-flex items-center max-w-full rounded-full border border-[#D4AF37]/35 bg-[#0A0A0F]/60 backdrop-blur-sm text-[#F3E3A6] font-medium ${sz} ${className}`}
      title="Status"
    >
      {status.emoji && <span aria-hidden="true">{status.emoji}</span>}
      <span className="truncate">{status.text}</span>
    </span>
  );
}
