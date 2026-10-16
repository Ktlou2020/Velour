import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Crown, Gift, UserPlus, MailCheck, Sparkles } from 'lucide-react';
import { BONUS_SUPER_LIKES, MONTHLY_CAP, REWARD_DAYS, referralSummary } from '@/lib/referrals';
import { formatDate } from '@/lib/subscriptions';
import InviteShare from './InviteShare';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Invite friends', robots: { index: false } };

const STATUS: Record<'PENDING' | 'REWARDED' | 'REJECTED', { label: string; cls: string }> = {
  PENDING: { label: 'Setting up', cls: 'bg-white/10 text-white/70 border-white/15' },
  REWARDED: { label: 'Gold unlocked', cls: 'bg-[#D4AF37]/15 text-[#F5D77A] border-[#D4AF37]/30' },
  REJECTED: { label: 'Not eligible', cls: 'bg-white/5 text-white/45 border-white/10' },
};

export default async function InvitePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=/invite');
  const s = await referralSummary(session.user.id);
  const shareText = `Join me on Unbound — a private, discreet community for singles and couples in SA (18+). Sign up with my link and we both get a week of Gold: ${s.link}`;

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4AF37]/30 to-[#DC143C]/20 border border-[#D4AF37]/30 flex items-center justify-center">
            <Gift size={22} className="text-[#F5D77A]" aria-hidden="true" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-white mb-2">Invite a friend, you both get a week of Gold</h1>
          <p className="text-white/65 text-sm">Know someone who&apos;d fit in? Share your private link. Once they&apos;re set up, Gold is on us — for both of you.</p>
        </div>

        <section aria-labelledby="link-h" className="glass rounded-2xl p-5 sm:p-6 mb-6 border border-[#D4AF37]/20">
          <h2 id="link-h" className="text-white font-semibold mb-3">Your invite link</h2>
          <InviteShare link={s.link} shareText={shareText} />
        </section>

        <section aria-labelledby="stats-h" className="mb-6">
          <h2 id="stats-h" className="sr-only">Your invites so far</h2>
          <dl className="grid grid-cols-3 gap-3">
            {([
              { label: 'Invited', value: s.stats.invited, Icon: UserPlus, hint: 'Signed up with your link' },
              { label: 'Joined', value: s.stats.joined, Icon: MailCheck, hint: 'Confirmed their email' },
              { label: 'Rewarded', value: s.stats.rewarded, Icon: Crown, hint: 'Gold unlocked for you both' },
            ] as const).map(({ label, value, Icon, hint }) => (
              <div key={label} className="glass rounded-2xl p-4 text-center" title={hint}>
                <Icon size={16} className="mx-auto mb-1.5 text-[#D4AF37]" aria-hidden="true" />
                <dd className="text-2xl font-bold text-white">{value}</dd>
                <dt className="text-white/55 text-xs">{label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="list-h" className="glass rounded-2xl p-5 sm:p-6 mb-6">
          <h2 id="list-h" className="text-white font-semibold mb-3">Your invites</h2>
          {s.referrals.length === 0 ? (
            <p className="text-white/55 text-sm">No one yet — your first invite is a message away.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {s.referrals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{r.name}</p>
                    <p className="text-white/45 text-xs">Joined {formatDate(r.createdAt)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="rules-h" className="glass rounded-2xl p-5 sm:p-6">
          <h2 id="rules-h" className="text-white font-semibold mb-3 flex items-center gap-2"><Sparkles size={16} className="text-[#D4AF37]" aria-hidden="true" />How it works</h2>
          <ul className="space-y-2 text-white/70 text-sm list-disc pl-5">
            <li>Your friend signs up with your link, confirms their email and adds a profile photo.</li>
            <li>You each get {REWARD_DAYS} days of Gold. Already Gold or Platinum? You get {BONUS_SUPER_LIKES} bonus super likes instead.</li>
            <li>Free weeks stack, and end on their own — nothing to cancel, nothing to pay.</li>
            <li>Up to {MONTHLY_CAP} rewards in any 30 days. Invites are for real people you know — no self-invites.</li>
            <li>Your link never shows your name or profile to anyone you send it to.</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
}
