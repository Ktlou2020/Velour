import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import Navbar from '@/components/Navbar';
import ReviewForm from '@/components/reviews/ReviewForm';
import { isValidId } from '@/lib/security';
import { CRITERIA, checkCanRequest, reviewMaintenance, reviewPersonSelect, toReviewPerson, type Ratings } from '@/lib/reviews';
import { getPartnerMap, isBlockedBetween, sideOf } from '@/lib/couples';

export const dynamic = 'force-dynamic';

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass rounded-3xl p-8 text-center">
      <h1 className="font-serif text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-white/65 text-sm leading-relaxed max-w-sm mx-auto">{body}</p>
      <Link href="/reviews" className="inline-block mt-6 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] text-white px-6 py-3 rounded-xl font-semibold text-sm">Your reviews</Link>
    </div>
  );
}

export default async function WriteReviewPage({ params }: { params: Promise<{ requestId: string }> }) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) redirect('/auth/signin');
  const { requestId } = await params;

  await reviewMaintenance();
  const request = isValidId(requestId)
    ? await db.reviewRequest.findUnique({
        where: { id: requestId },
        select: { id: true, reviewerId: true, requesterId: true, status: true, expiresAt: true, requester: { select: reviewPersonSelect } },
      })
    : null;

  let content: React.ReactNode;
  if (!request || request.reviewerId !== me) {
    content = <Notice title="Review request not found" body="This link may be old, or the request was cancelled." />;
  } else {
    const person = toReviewPerson(request.requester);
    const pm = await getPartnerMap([me, request.requesterId]);
    const blocked = await isBlockedBetween(sideOf(me, pm), sideOf(request.requesterId, pm));
    const review = await db.review.findUnique({
      where: { reviewerId_revieweeId: { reviewerId: me, revieweeId: request.requesterId } },
      select: { id: true, publishedAt: true, comment: true, isExplicit: true, respectful: true, communication: true, authenticity: true, reliability: true, overall: true },
    });
    if (blocked || !request.requester.isActive) {
      content = <Notice title="This review isn’t available" body="You can’t review this member right now." />;
    } else if (review?.publishedAt) {
      content = <Notice title="Your review is live" body={`Your review of ${person.name} has been published, so it can’t be edited any more.`} />;
    } else if (review) {
      const ratings = {} as Ratings;
      for (const c of CRITERIA) ratings[c.key] = review[c.key];
      content = <ReviewForm requestId={request.id} reviewee={person} existing={{ id: review.id, ratings, comment: review.comment, isExplicit: review.isExplicit }} canAskBack={false} />;
    } else if (request.status !== 'PENDING' || request.expiresAt <= new Date()) {
      content = <Notice title="This request has closed" body={request.status === 'DECLINED' ? 'You chose not to review this time.' : 'Review requests are open for 30 days. They can always ask you again.'} />;
    } else {
      const askBack = await checkCanRequest(me, request.requesterId);
      content = <ReviewForm requestId={request.id} reviewee={person} canAskBack={askBack.ok} />;
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <div className="max-w-xl mx-auto px-4 pt-8 pb-28 sm:pt-12 md:pb-12">{content}</div>
      </main>
    </div>
  );
}
