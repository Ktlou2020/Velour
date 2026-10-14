import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { todaySpark } from '@/lib/spark';
import { loadFeed, loadSparkAnswers, loadSparkStreak } from '@/app/api/spark/data';
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
  const [feed, streak, history, count] = await Promise.all([
    myAnswer ? loadFeed(userId, today.key, today.question, myAnswer, {}) : Promise.resolve(null),
    loadSparkStreak(userId),
    loadSparkAnswers(userId, 14, { excludeKey: today.key }),
    db.sparkAnswer.count({ where: { questionId: today.key } }),
  ]);

  const initial: SparkInitial = {
    question: today.question,
    dateKey: today.dateKey,
    closesAt: today.closesAt,
    myAnswer,
    count,
    streak,
    history,
    feed: feed?.items ?? null,
    nextCursor: feed?.nextCursor ?? null,
    feedTotal: feed?.total ?? null,
    sameCount: feed?.sameCount ?? null,
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
