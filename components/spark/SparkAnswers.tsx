import { Sparkles } from 'lucide-react';

export interface SparkAnswerView {
  key: string;
  question: string;
  answer: string;
  dateKey: string | null;
  isPick: boolean;
}

/** A member's last few Daily Spark answers — one compact card on their profile. */
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
    <section className={`glass rounded-2xl p-5 ${className}`} aria-labelledby="spark-answers-heading">
      <h2 id="spark-answers-heading" className="font-serif text-lg font-bold text-white mb-3 flex items-center gap-2">
        <Sparkles size={16} className="text-[#D4AF37]" aria-hidden="true" />
        {title}
      </h2>
      {answers.length ? (
        <ul className="divide-y divide-white/5">
          {answers.map((a) => (
            <li key={a.key} className="py-2.5 first:pt-0 last:pb-0">
              <p className="text-white/55 text-xs leading-snug">{a.question}</p>
              <p className="mt-0.5 text-white text-[15px] leading-snug break-words">{a.answer}</p>
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
