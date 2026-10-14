import { ORDER_STATUS_LABEL, type OrderStatus } from '@/lib/store/config';

const STYLE: Record<string, string> = {
  PENDING_PAYMENT: 'bg-[#D4AF37]/15 text-[#F5D77A]',
  PAID: 'bg-emerald-500/15 text-emerald-300',
  PROCESSING: 'bg-sky-500/15 text-sky-300',
  SHIPPED: 'bg-violet-500/15 text-violet-300',
  DELIVERED: 'bg-emerald-500/15 text-emerald-300',
  CANCELLED: 'bg-white/10 text-white/60',
  REFUNDED: 'bg-white/10 text-white/60',
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STYLE[status] ?? 'bg-white/10 text-white/60'}`}>
      {ORDER_STATUS_LABEL[status as OrderStatus] ?? status}
    </span>
  );
}
