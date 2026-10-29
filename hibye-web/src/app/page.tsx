import { Suspense } from 'react';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Landing } from '@/components/landing/Landing';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCurrentUser } from '@/lib/auth';

// '/' — 로그인 여부로 소개 랜딩 / 대시보드 분기 (쿠키 읽는 부분은 Suspense 안에서)
export default function HomePage() {
    return (
        <Suspense fallback={<HomeFallback />}>
            <Home />
        </Suspense>
    );
}

async function Home() {
    const user = await getCurrentUser();
    if (!user) return <Landing />;
    return <Dashboard user={user} />;
}

function HomeFallback() {
    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
            <Skeleton className="mb-3 h-5 w-48" />
            <Skeleton className="mb-8 h-8 w-80" />
            <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
            </div>
        </main>
    );
}
