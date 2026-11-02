import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AdminPage } from '@/components/admin/AdminPage';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCurrentUser } from '@/lib/auth';
import { canManageHomepage } from '@/lib/homepage';

export const metadata: Metadata = { title: '관리 — hibye' };

// /admin — 관리자(전체 탭) 또는 홈페이지 권한자(홈페이지 탭만). API(requireAdmin·requireHomepage)도 다시 검사
export default function AdminRoute({ searchParams }: PageProps<'/admin'>) {
    return (
        <Suspense fallback={<AdminFallback />}>
            <Admin searchParams={searchParams} />
        </Suspense>
    );
}

async function Admin({ searchParams }: { searchParams: PageProps<'/admin'>['searchParams'] }) {
    const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
    if (!user) redirect('/login?redirect=/admin');
    if (!canManageHomepage({ user_role: user.user_role ?? 'member', homepage_access: user.homepage_access })) redirect('/');
    const tab = typeof params.tab === 'string' ? params.tab : undefined;
    return <AdminPage myUserId={user.user_id} homepageOnly={user.user_role !== 'admin'} initialTab={tab} />;
}

function AdminFallback() {
    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
            <Skeleton className="mb-6 h-8 w-32" />
            <Skeleton className="h-64 w-full" />
        </main>
    );
}
