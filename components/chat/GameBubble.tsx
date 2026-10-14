'use client';

import { useState } from 'react';
import { Check, X as XIcon } from 'lucide-react';
import { GAME_INFO, MAX_ANSWER_TEXT, type GameAnswer, type GameMeta } from '@/lib/chat-games';

interface Props {
  meta: GameMeta;
  senderId: string;
  myId: string;
  /** The viewer and their linked partner (the viewer's side of the chat) */
  mySide: string[];
  sent: boolean;
  /** userId → display name */
  nameOf: (userId: string) => string;
  disabled?: boolean;
  pending?: boolean;
  onAnswer: (answer: number | string) => Promise<string | null>;
}

const STAMP = ['A', 'B', 'C'];

export default function GameBubble({ meta, senderId, myId, mySide, sent, nameOf, disabled = false, pending = false, onAnswer }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState('');
  const info = GAME_INFO[meta.game];
  const answers = meta.answers ?? {};
  const mine = answers[myId];
  const onSenderSide = senderId === myId || mySide.includes(senderId);
  const entries = Object.entries(answers) as [string, GameAnswer][];
  const others = entries.filter(([uid]) => uid !== senderId);

  function who(uid: string, a?: GameAnswer) {
    if (uid === myId) return a?.as ? `You (${a.as})` : 'You';
    return a?.as || nameOf(uid);
  }

  async function answer(v: number | string) {
    if (busy || disabled || pending) return;
    setBusy(true);
    setErr(null);
    const e = await onAnswer(v);
    if (e) setErr(e);
    setBusy(false);
  }

  const header = (
    <div className="flex items-center justify-between gap-2 mb-2">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]">
        <span aria-hidden="true">🎲</span> {info.title}
      </span>
      {pending && <span className="text-[10px] text-white/50">Sending…</span>}
    </div>
  );

  let body: React.ReactNode = null;

  if (meta.game === 'this_or_that' || meta.game === 'would_you_rather') {
    const opts = meta.options ?? [];
    const senderAns = answers[senderId];
    const canPick = !mine && !onSenderSide && !disabled;
    const revealed = !!mine || onSenderSide;
    // Result line: the sender's pick vs the viewer's (or, for the sender, the first other player's)
    const compareTo = senderId === myId ? others[0]?.[1] : mine;
    const compareWho = senderId === myId ? others[0]?.[0] : myId;
    let result: string | null = null;
    if (revealed && senderAns && compareTo && typeof senderAns.choice === 'number' && typeof compareTo.choice === 'number') {
      if (senderAns.choice === compareTo.choice) {
        result = compareWho === myId || senderId === myId
          ? `You both picked ${opts[senderAns.choice]} 🔥`
          : `${who(senderId, senderAns)} & ${who(compareWho!, compareTo)} both picked ${opts[senderAns.choice]} 🔥`;
      } else {
        result = 'Different taste! 😄';
      }
    }
    body = (
      <>
        <p className="text-sm font-medium text-white leading-snug mb-2.5">
          {meta.game === 'this_or_that' ? 'This or that?' : 'Would you rather…'}
        </p>
        <div className="flex flex-col gap-1.5">
          {opts.map((o, i) => {
            const pickers = revealed ? entries.filter(([, a]) => a.choice === i) : [];
            const myPick = mine?.choice === i;
            return (
              <button
                key={i}
                type="button"
                disabled={!canPick || busy}
                onClick={() => answer(i)}
                className={`relative text-left text-sm rounded-xl px-3 py-2 border transition-colors ${
                  myPick
                    ? 'bg-[#DC143C]/25 border-[#DC143C]/70 text-white'
                    : canPick
                      ? 'bg-white/5 border-white/10 text-white/90 hover:border-[#D4AF37]/60 hover:bg-white/10'
                      : 'bg-white/5 border-white/10 text-white/80'
                } disabled:cursor-default`}
              >
                <span className="block pr-1">{o}</span>
                {pickers.length > 0 && (
                  <span className="block text-[11px] text-[#D4AF37] mt-0.5">
                    {pickers.map(([uid, a]) => who(uid, a)).join(', ')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-2 text-white/65">
          {result
            ? <span className="text-[#D4AF37] font-medium">{result}</span>
            : canPick
              ? senderAns ? `${who(senderId, senderAns)} picked — your turn!` : 'Tap your pick'
              : onSenderSide && others.length === 0
                ? 'Waiting for their pick…'
                : !revealed ? 'Answered' : null}
        </p>
      </>
    );
  } else if (meta.game === 'two_truths') {
    const opts = meta.options ?? [];
    const canGuess = !mine && !onSenderSide && !disabled;
    const revealed = typeof meta.lie === 'number';
    const guessers = entries.filter(([uid]) => uid !== senderId);
    let result: string | null = null;
    if (revealed && mine && typeof mine.choice === 'number') {
      result = mine.choice === meta.lie ? 'You spotted the lie! 🎉' : 'Fooled you! 😏';
    }
    body = (
      <>
        <p className="text-sm font-medium text-white leading-snug mb-2.5">
          {canGuess ? 'Which one is the lie?' : onSenderSide ? 'Two truths and a lie' : 'Which one was the lie?'}
        </p>
        <div className="flex flex-col gap-1.5">
          {opts.map((o, i) => {
            const isLie = revealed && meta.lie === i;
            const guessedHere = revealed ? guessers.filter(([, a]) => a.choice === i) : [];
            return (
              <button
                key={i}
                type="button"
                disabled={!canGuess || busy}
                onClick={() => answer(i)}
                className={`text-left text-sm rounded-xl px-3 py-2 border transition-colors flex gap-2 ${
                  revealed
                    ? isLie
                      ? 'bg-[#DC143C]/20 border-[#DC143C]/60 text-white'
                      : 'bg-emerald-500/10 border-emerald-400/30 text-white/90'
                    : canGuess
                      ? 'bg-white/5 border-white/10 text-white/90 hover:border-[#D4AF37]/60 hover:bg-white/10'
                      : 'bg-white/5 border-white/10 text-white/80'
                } disabled:cursor-default`}
              >
                <span className="text-[11px] font-bold text-white/45 mt-0.5 flex-shrink-0">{STAMP[i]}</span>
                <span className="flex-1 min-w-0">
                  <span className="block break-words">{o}</span>
                  {revealed && (
                    <span className={`flex items-center gap-1 text-[11px] mt-0.5 ${isLie ? 'text-[#FF6B81]' : 'text-emerald-300'}`}>
                      {isLie ? <><XIcon size={11} /> The lie</> : <><Check size={11} /> Truth</>}
                      {guessedHere.length > 0 && (
                        <span className="text-white/55">· {guessedHere.map(([uid, a]) => who(uid, a)).join(', ')} guessed this</span>
                      )}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-2 text-white/65">
          {result
            ? <span className="text-[#D4AF37] font-medium">{result}</span>
            : canGuess
              ? 'Tap the one you think is false'
              : onSenderSide
                ? guessers.length === 0
                  ? 'Waiting for their guess…'
                  : guessers.map(([uid, a]) => `${who(uid, a)} ${a.choice === meta.lie ? 'spotted it 🎉' : 'got fooled 😏'}`).join(' · ')
                : null}
        </p>
      </>
    );
  } else {
    // 21 Questions
    const canAnswer = !mine && !disabled;
    const hiddenCount = entries.filter(([, a]) => a.hidden).length;
    body = (
      <>
        <p className="text-[15px] font-serif text-white leading-snug mb-2.5">{meta.prompt}</p>
        {entries.filter(([, a]) => !a.hidden && a.text).map(([uid, a]) => (
          <div key={uid} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 mb-1.5">
            <div className="text-[11px] text-[#D4AF37] mb-0.5">{who(uid, a)}</div>
            <div className="text-sm text-white/90 whitespace-pre-wrap break-words">{a.text}</div>
          </div>
        ))}
        {hiddenCount > 0 && !mine && (
          <p className="text-xs text-white/60 mb-1.5">
            {entries.filter(([, a]) => a.hidden).map(([uid, a]) => who(uid, a)).join(', ')} answered — answer to see theirs 👀
          </p>
        )}
        {canAnswer && (
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => { e.preventDefault(); if (text.trim()) answer(text.trim()); }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={MAX_ANSWER_TEXT}
              placeholder="Your answer…"
              aria-label="Your answer"
              className="input-dark w-full rounded-xl px-3 py-2 text-sm resize-none"
            />
            <button
              type="submit"
              disabled={!text.trim() || busy || pending}
              className="self-end text-xs font-semibold px-3 py-1.5 rounded-full bg-[#D4AF37] text-black disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Answer'}
            </button>
          </form>
        )}
        {!canAnswer && entries.length < 2 && (
          <p className="text-xs text-white/60">Waiting for their answer…</p>
        )}
      </>
    );
  }

  return (
    <div
      className={`w-[268px] max-w-full rounded-2xl p-3 border ${sent ? 'rounded-tr-sm' : 'rounded-tl-sm'} bg-gradient-to-br from-[#1a1022] to-[#12121a] border-[#D4AF37]/25 ${pending ? 'opacity-70' : ''}`}
    >
      {header}
      {body}
      {err && <p className="text-xs text-red-400 mt-1.5">{err}</p>}
    </div>
  );
}
