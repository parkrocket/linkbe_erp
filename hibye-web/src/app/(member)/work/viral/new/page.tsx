import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { BoardForm } from '@/components/work/board/BoardForm';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canWorkDoc } from '@/lib/workDoc';

export const metadata: Metadata = { title: '새 글 — hibye' };

// /work/viral/new — 새 글 쓰기
export default function NewViralRoute() {
    return (
        <Suspense
            fallback={
                <Skeleton className="mx-auto mt-10 h-96 w-full max-w-5xl" />
            }
        >
            <NewViral />
        </Suspense>
    );
}

async function NewViral() {
    const user = await getCurrentUser();
    if (!user) redirect('/login?redirect=/work/viral/new');
    if (!canWorkDoc(user)) redirect('/work/expense');
    return (
        <>
            <WorkTabs user={user} />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
                <h1 className="mb-5 text-2xl font-bold">새 글</h1>
                <BoardForm />
            </main>
        </>
    );
}
