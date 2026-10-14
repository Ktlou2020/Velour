'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Shuffle, X } from 'lucide-react';
import {
  GAME_INFO,
  GAME_KINDS,
  MAX_ANSWER_TEXT,
  MAX_STATEMENT,
  QUESTIONS,
  THIS_OR_THAT,
  WOULD_YOU_RATHER,
  randomPrompt,
  type ChoicePrompt,
  type GameKind,
  type QuestionPrompt,
} from '@/lib/chat-games';

export type NewGame =
  | { game: 'this_or_that' | 'would_you_rather'; promptId: string; choice: 0 | 1 }
  | { game: 'questions'; promptId: string; text?: string }
  | { game: 'two_truths'; statements: string[]; lie: 0 | 1 | 2 };

interface Props {
  open: boolean;
  name: string;
  onClose: () => void;
  onSend: (game: NewGame) => Promise<string | null>;
}

export default function GameSheet({ open, name, onClose, onSend }: Props) {
  const [game, setGame] = useState<GameKind | null>(null);
  const [choicePrompt, setChoicePrompt] = useState<ChoicePrompt | null>(null);
  const [question, setQuestion] = useState<QuestionPrompt | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [choice, setChoice] = useState<0 | 1 | null>(null);
  const [text, setText] = useState('');
  const [statements, setStatements] = useState(['', '', '']);
  const [lie, setLie] = useState<0 | 1 | 2 | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setGame(null); setErr(null); setBusy(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function choose(g: GameKind) {
    setGame(g);
    setErr(null);
    setChoice(null);
    setText('');
    if (g === 'this_or_that' || g === 'would_you_rather') {
      const p = randomPrompt(g === 'this_or_that' ? THIS_OR_THAT : WOULD_YOU_RATHER, seen);
      setChoicePrompt(p);
      setSeen((s) => [...s, p.id]);
    } else if (g === 'questions') {
      const q = randomPrompt(QUESTIONS, seen);
      setQuestion(q);
      setSeen((s) => [...s, q.id]);
    } else {
      setStatements(['', '', '']);
      setLie(null);
    }
  }

  function shuffle() {
    if (game) {
      setChoice(null);
      if (game === 'questions') {
        const q = randomPrompt(QUESTIONS, [...seen, question?.id ?? '']);
        setQuestion(q);
        setSeen((s) => [...s, q.id]);
      } else {
        const p = randomPrompt(game === 'this_or_that' ? THIS_OR_THAT : WOULD_YOU_RATHER, [...seen, choicePrompt?.id ?? '']);
        setChoicePrompt(p);
        setSeen((s) => [...s, p.id]);
      }
    }
  }

  let payload: NewGame | null = null;
  if ((game === 'this_or_that' || game === 'would_you_rather') && choicePrompt && choice !== null) {
    payload = { game, promptId: choicePrompt.id, choice };
  } else if (game === 'questions' && question) {
    payload = { game, promptId: question.id, ...(text.trim() ? { text: text.trim() } : {}) };
  } else if (game === 'two_truths' && lie !== null && statements.every((s) => s.trim())) {
    payload = { game, statements: statements.map((s) => s.trim()), lie };
  }

  async function send() {
    if (!payload || busy) return;
    setBusy(true);
    setErr(null);
    const e = await onSend(payload);
    setBusy(false);
    if (e) setErr(e); else onClose();
  }

  if (!open || typeof document === 'undefined') return null;

  // Portal to <body>: escapes any stacking context so it sits above the mobile tab bar
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label="Play a game">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative w-full md:max-w-md max-h-[88dvh] overflow-y-auto glass-dark border border-white/10 rounded-t-3xl md:rounded-3xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-5 shadow-2xl shadow-black/60">
        <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <div className="flex items-center gap-2 mb-4">
          {game && (
            <button type="button" onClick={() => setGame(null)} className="w-8 h-8 -ml-1 rounded-lg flex items-center justify-center text-white/70 hover:text-white" aria-label="Back to games">
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="font-serif text-white text-lg font-bold flex-1 truncate">
            {game ? `${GAME_INFO[game].emoji} ${GAME_INFO[game].title}` : `Play with ${name}`}
          </h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!game && (
          <div className="grid grid-cols-2 gap-2.5">
            {GAME_KINDS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => choose(g)}
                className="text-left rounded-2xl p-3.5 bg-white/5 border border-white/10 hover:border-[#D4AF37]/50 hover:bg-white/10 transition-colors"
              >
                <div className="text-2xl mb-1.5" aria-hidden="true">{GAME_INFO[g].emoji}</div>
                <div className="text-white text-sm font-semibold">{GAME_INFO[g].title}</div>
                <div className="text-white/55 text-xs mt-0.5 leading-snug">{GAME_INFO[g].blurb}</div>
              </button>
            ))}
            <p className="col-span-2 text-center text-[11px] text-white/45 mt-1">Free for everyone · answers stay hidden until they play</p>
          </div>
        )}

        {(game === 'this_or_that' || game === 'would_you_rather') && choicePrompt && (
          <div>
            <p className="text-white/70 text-sm mb-3">{game === 'this_or_that' ? 'This or that?' : 'Would you rather…'} <span className="text-white/45">Make your pick — {name} sees it after choosing.</span></p>
            <div className="flex flex-col gap-2">
              {[choicePrompt.a, choicePrompt.b].map((o, i) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setChoice(i as 0 | 1)}
                  className={`text-left rounded-xl px-4 py-3 border text-sm transition-colors ${choice === i ? 'bg-[#DC143C]/25 border-[#DC143C]/70 text-white' : 'bg-white/5 border-white/10 text-white/85 hover:border-white/25'}`}
                >
                  {o}
                </button>
              ))}
            </div>
            <button type="button" onClick={shuffle} className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#D4AF37] hover:text-[#e8c65a]">
              <Shuffle size={13} /> Shuffle
            </button>
          </div>
        )}

        {game === 'questions' && question && (
          <div>
            <div className="rounded-2xl p-4 bg-gradient-to-br from-[#1a1022] to-[#12121a] border border-[#D4AF37]/25">
              <span className="text-[10px] uppercase tracking-wider text-[#D4AF37]">{question.tone === 'deep' ? 'Deep' : 'Fun'}</span>
              <p className="font-serif text-white text-lg leading-snug mt-1">{question.q}</p>
            </div>
            <button type="button" onClick={shuffle} className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-[#D4AF37] hover:text-[#e8c65a]">
              <Shuffle size={13} /> Another question
            </button>
            <label className="block text-xs text-white/60 mt-3 mb-1.5" htmlFor="game-own-answer">Your answer (optional — hidden until they answer)</label>
            <textarea
              id="game-own-answer"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_ANSWER_TEXT}
              rows={2}
              className="input-dark w-full rounded-xl px-3 py-2 text-sm resize-none"
              placeholder="Answer it yourself first…"
            />
          </div>
        )}

        {game === 'two_truths' && (
          <div className="flex flex-col gap-2">
            <p className="text-white/70 text-sm mb-1">Write two true things and one lie about yourself, then mark the lie.</p>
            {statements.map((s, i) => (
              <div key={i} className={`rounded-xl border p-2 transition-colors ${lie === i ? 'border-[#DC143C]/60 bg-[#DC143C]/10' : 'border-white/10 bg-white/5'}`}>
                <input
                  value={s}
                  onChange={(e) => setStatements((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                  maxLength={MAX_STATEMENT}
                  className="input-dark w-full rounded-lg px-3 py-2 text-sm"
                  placeholder={['I once met a celebrity at the airport', 'I can cook a mean potjie', 'I’ve been bungee jumping at Bloukrans'][i]}
                  aria-label={`Statement ${i + 1}`}
                />
                <label className="mt-1.5 flex items-center gap-2 text-xs text-white/65 cursor-pointer select-none">
                  <input type="radio" name="lie" checked={lie === i} onChange={() => setLie(i as 0 | 1 | 2)} className="accent-[#DC143C]" />
                  This one is the lie
                </label>
              </div>
            ))}
          </div>
        )}

        {game && (
          <>
            {err && <p className="text-red-400 text-xs mt-3">{err}</p>}
            <button
              type="button"
              onClick={send}
              disabled={!payload || busy}
              className="btn-crimson w-full mt-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? 'Sending…' : (game === 'this_or_that' || game === 'would_you_rather') && choice === null ? 'Make your pick to send' : game === 'two_truths' && lie === null ? 'Mark the lie to send' : `Send to ${name}`}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
