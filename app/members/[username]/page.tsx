import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import MemberProfileClient from './MemberProfileClient';

interface PageProps {
  params: Promise<{ username: string }>;
}

async function getMemberProfile(username: string) {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/profile/${username}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function MemberProfilePage({ params }: PageProps) {
  const { username } = await params;
  const session = await auth();

  // Redirect to own profile if viewing self
  const currentUser = session?.user as { username?: string } | undefined;
  if (currentUser?.username && currentUser.username === username) {
    redirect('/profile');
  }

  const profile = await getMemberProfile(username);

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <MemberProfileClient username={username} profile={profile} session={session} />
      </main>
      <Footer />
    </div>
  );
}
