import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { todaySpark } from '@/lib/spark';
import { loadFeed } from '@/app/api/spark/data';
import SparkClient, { type SparkInitial } from './SparkClient';

export const dynamic = 'force-dynamic';

export default async function SparkPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/signin');

  const today = todaySpark();
  const mine = await db.sparkAnswer.findUnique({
    where: { userId_questionId: { userId, questionId: today.key } },
    select: { answer: true },
  });
  const myAnswer = mine?.answer ?? null;
  const [feed, count] = await Promise.all([
    myAnswer ? loadFeed(userId, today.key, {}) : Promise.resolve(null),
    db.sparkAnswer.count({ where: { questionId: today.key } }),
  ]);

  const initial: SparkInitial = {
    question: today.question,
    dateKey: today.dateKey,
    myAnswer,
    count,
    feed: feed?.items ?? null,
    nextCursor: feed?.nextCursor ?? null,
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <SparkClient initial={initial} />
      </main>
      <Footer />
    </div>
  );
}
