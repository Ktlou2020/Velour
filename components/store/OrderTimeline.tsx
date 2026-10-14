import { Ban, CheckCircle2, Clock, CreditCard, Home, PackageCheck, RotateCcw, Truck } from 'lucide-react';
import { formatDateTime } from '@/lib/store/format';

interface Props {
  status: string;
  createdAt: Date | string;
  paidAt: Date | string | null;
  shippedAt: Date | string | null;
  deliveredAt: Date | string | null;
  cancelledAt: Date | string | null;
}

const STEPS = [
  { key: 'PENDING_PAYMENT', label: 'Pending payment', icon: Clock },
  { key: 'PAID', label: 'Paid', icon: CreditCard },
  { key: 'PROCESSING', label: 'Processing', icon: PackageCheck },
  { key: 'SHIPPED', label: 'Shipped', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: Home },
] as const;

export default function OrderTimeline({ status, createdAt, paidAt, shippedAt, deliveredAt, cancelledAt }: Props) {
  if (status === 'CANCELLED' || status === 'REFUNDED') {
    const Icon = status === 'CANCELLED' ? Ban : RotateCcw;
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <Icon size={20} className="text-white/60" aria-hidden="true" />
        <div>
          <p className="text-white font-medium">{status === 'CANCELLED' ? 'Cancelled' : 'Refunded'}</p>
          <p className="text-white/50 text-xs">
            {status === 'CANCELLED' && cancelledAt ? formatDateTime(cancelledAt) : null}
            {status === 'REFUNDED' ? 'Refunds can take a few working days to reflect.' : null}
          </p>
        </div>
      </div>
    );
  }
  const idx = STEPS.findIndex((s) => s.key === status);
  const when: Record<string, Date | string | null> = { PENDING_PAYMENT: createdAt, PAID: paidAt, PROCESSING: null, SHIPPED: shippedAt, DELIVERED: deliveredAt };
  return (
    <ol className="relative grid grid-cols-5 gap-1" aria-label="Order progress">
      {STEPS.map((s, i) => {
        // Every step up to and including the current status has been reached.
        const done = i <= idx;
        const current = i === idx;
        const Icon = done && !current ? CheckCircle2 : s.icon;
        return (
          <li key={s.key} className="flex flex-col items-center text-center relative" aria-current={current ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${i <= idx ? 'bg-[#DC143C]/70' : 'bg-white/10'}`} />}
            <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border ${done ? `bg-[#DC143C] border-[#DC143C] text-white ${current ? 'ring-4 ring-[#DC143C]/25' : ''}` : 'bg-[#0A0A0F] border-white/15 text-white/35'}`}>
              <Icon size={15} aria-hidden="true" />
            </span>
            <span className={`mt-2 text-[10px] sm:text-xs leading-tight ${done ? 'text-white' : 'text-white/40'}`}>{s.label}</span>
            {when[s.key] && done && <span className="hidden sm:block text-[10px] text-white/40 mt-0.5">{formatDateTime(when[s.key]!)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
