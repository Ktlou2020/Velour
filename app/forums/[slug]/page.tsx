import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { auth } from '@/auth';
import ForumSlugClient from './ForumSlugClient';

interface Thread {
  id: string;
  title: string;
  authorName?: string;
  authorAvatar?: string;
  replyCount?: number;
  views?: number;
  lastReplyAt?: string;
  createdAt?: string;
  isPinned?: boolean;
}

interface ForumCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  threadCount?: number;
}

interface PageData {
  category: ForumCategory | null;
  threads: Thread[];
  total: number;
}

async function getForumData(slug: string, page: number): Promise<PageData> {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/forums/${slug}?page=${page}&limit=20`,
      { cache: 'no-store' }
    );
    if (!res.ok) return { category: null, threads: [], total: 0 };
    const data = await res.json();
    return {
      category: data.category || null,
      threads: data.threads || [],
      total: data.total || 0,
    };
  } catch {
    return { category: null, threads: [], total: 0 };
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function ForumSlugPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = parseInt(pageStr || '1', 10);
  const session = await auth();
  const { category, threads, total } = await getForumData(slug, page);

  const userTier = (session?.user as { membershipTier?: string } | undefined)?.membershipTier || 'FREE';
  const canPost = userTier === 'GOLD' || userTier === 'PLATINUM';

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <ForumSlugClient
          slug={slug}
          category={category}
          threads={threads}
          total={total}
          currentPage={page}
          canPost={canPost}
        />
      </main>
      <Footer />
    </div>
  );
}
