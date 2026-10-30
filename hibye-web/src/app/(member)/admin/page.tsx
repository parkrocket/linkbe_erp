import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AdminPage } from '@/components/admin/AdminPage';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: '관리 — hibye' };

// /admin — 관리자만. 화면에서 막는 것과 별개로 API(requireAdmin)도 다시 검사
export default function AdminRoute() {
    return (
        <Suspense fallback={<AdminFallback />}>
            <Admin />
        </Suspense>
    );
}

async function Admin() {
    const user = await getCurrentUser();
    if (!user) redirect('/login?redirect=/admin');
    if (user.user_role !== 'admin') redirect('/');
    return <AdminPage myUserId={user.user_id} />;
}

function AdminFallback() {
    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
            <Skeleton className="mb-6 h-8 w-32" />
            <Skeleton className="h-64 w-full" />
        </main>
    );
}
