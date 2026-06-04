'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X, Sparkles } from 'lucide-react';
import { useToastInternal, type Toast } from '@/lib/toast-context';

export { ToastProvider, useToast } from '@/lib/toast-context';

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle,
    bg: 'bg-emerald-900/80 border-emerald-500/40',
    iconColor: 'text-emerald-400',
  },
  error: {
    icon: XCircle,
    bg: 'bg-[#DC143C]/20 border-[#DC143C]/40',
    iconColor: 'text-[#DC143C]',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-900/80 border-blue-500/40',
    iconColor: 'text-blue-400',
  },
  match: {
    icon: Sparkles,
    bg: 'bg-[#D4AF37]/20 border-[#D4AF37]/40',
    iconColor: 'text-[#D4AF37]',
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const config = TYPE_CONFIG[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  }

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl max-w-xs w-full transition-all duration-300 ${config.bg} ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      }`}
      role="alert"
    >
      <Icon size={18} className={`flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      <p className="text-white text-sm leading-snug flex-1">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-white/40 hover:text-white transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastInternal();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}
