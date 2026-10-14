import { Sparkles } from 'lucide-react';

export interface SparkAnswerView {
  key: string;
  question: string;
  answer: string;
  dateKey: string | null;
  isPick: boolean;
}

function dateLabel(dateKey: string | null): string | null {
  if (!dateKey) return null;
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });
}

/** A member's recent Daily Spark answers ("Their Spark answers" / "Your Spark answers"). */
export default function SparkAnswers({
  answers, title, emptyText, className = '', footer,
}: {
  answers: SparkAnswerView[];
  title: string;
  emptyText?: string;
  className?: string;
  footer?: React.ReactNode;
}) {
  if (!answers.length && !emptyText) return null;
  return (
    <section className={`glass rounded-2xl p-6 ${className}`} aria-labelledby="spark-answers-heading">
      <h2 id="spark-answers-heading" className="font-serif text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-[#D4AF37]" />
        {title}
      </h2>
      {answers.length ? (
        <ul className="space-y-3">
          {answers.map((a) => (
            <li key={a.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-white/60 text-xs font-medium leading-snug">{a.question}</p>
                {dateLabel(a.dateKey) && <span className="text-white/35 text-[11px] flex-shrink-0">{dateLabel(a.dateKey)}</span>}
              </div>
              {a.isPick ? (
                <span className="inline-block rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F3E3A6] text-sm px-3 py-1">{a.answer}</span>
              ) : (
                <p className="text-white font-serif text-lg leading-snug break-words">{a.answer}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-white/55 text-sm">{emptyText}</p>
      )}
      {footer}
    </section>
  );
}
