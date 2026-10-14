import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { isPaid } from '@/lib/premium';
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
    // Query the DB directly: a server-side fetch to our own API carries no
    // session cookie, so the auth-protected route would always 401.
    const category = await db.forumCategory.findUnique({ where: { slug } });
    if (!category) return { category: null, threads: [], total: 0 };
    const limit = 20;
    const [rows, total] = await Promise.all([
      db.forumThread.findMany({
        where: { categoryId: category.id },
        include: {
          author: { select: { username: true, profile: { select: { displayName: true, profilePhoto: true } } } },
          _count: { select: { posts: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.forumThread.count({ where: { categoryId: category.id } }),
    ]);
    return {
      category: {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description ?? undefined,
        threadCount: total,
      },
      threads: rows.map((t) => ({
        id: t.id,
        title: t.title,
        authorName: t.author.profile?.displayName || t.author.username,
        authorAvatar: t.author.profile?.profilePhoto ?? undefined,
        // first post is the opening post
        replyCount: Math.max(0, t._count.posts - 1),
        views: t.views,
        lastReplyAt: t.updatedAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
        isPinned: t.isPinned,
      })),
      total,
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
  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
  const session = await auth();
  const { category, threads, total } = await getForumData(slug, page);

  // membershipTier is not stored in the JWT session, so read it from the DB.
  let canPost = false;
  if (session?.user?.id) {
    const u = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, profile: { select: { membershipTier: true } } },
    });
    canPost = isPaid(u?.profile?.membershipTier, u?.role);
  }

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
