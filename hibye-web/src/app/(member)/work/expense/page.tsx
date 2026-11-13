import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ExpensePage } from '@/components/work/ExpensePage';
import { Skeleton } from '@/components/ui/Skeleton';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canApproveExpense } from '@/lib/work';

export const metadata: Metadata = { title: '경비 — hibye' };

// /work/expense — 월별 경비 목록·기안·승인
export default function ExpenseRoute() {
    return (
        <Suspense fallback={<ExpenseFallback />}>
            <Expense />
        </Suspense>
    );
}

async function Expense() {
    // proxy는 쿠키 유무만 보므로, 만료 토큰이면 여기서 로그인으로
    const user = await getCurrentUser();
    if (!user) redirect('/login?redirect=/work/expense');
    return (
        <>
            <WorkTabs user={user} />
            <ExpensePage canApprove={canApproveExpense(user)} />
        </>
    );
}

function ExpenseFallback() {
    return (
        <main className="mx-auto w-full max-w-page flex-1 px-4 py-10">
            <Skeleton className="mb-6 h-8 w-40" />
            <Skeleton className="h-96 w-full" />
        </main>
    );
}
