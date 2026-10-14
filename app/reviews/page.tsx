import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MyReviewsPanel from '@/components/reviews/MyReviewsPanel';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import { reviewsOverview } from '@/lib/reviews-overview';
import { firstName } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/signin');
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, profile: { select: { displayName: true, isCouple: true, coupleMembers: true } } },
  });
  if (!me) redirect('/auth/signin');
  const overview = await reviewsOverview(userId);

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10 space-y-6">
          <header>
            <p className="eyebrow text-[#D4AF37] mb-2">Trust on Hush</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white">Reviews</h1>
            <p className="text-white/65 text-sm mt-2 max-w-xl leading-relaxed">
              Members who&apos;ve chatted can review each other after they meet. Reviews are double-blind — hidden until you&apos;ve both written one, or for 14 days — and free for everyone.
            </p>
          </header>
          <MyReviewsPanel initial={JSON.parse(JSON.stringify(overview))} />
          <ReviewsSection username={me.username} name={firstName(me)} ownerView anchorId="received" showSummary={false} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
