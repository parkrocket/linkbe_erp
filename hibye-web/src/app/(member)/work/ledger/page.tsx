import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { LedgerPage } from '@/components/work/ledger/LedgerPage';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canWorkDoc } from '@/lib/workDoc';

export const metadata: Metadata = { title: '매출/매입 — hibye' };

// /work/ledger — 매출/매입 장부 (업무 문서 권한자만)
export default function LedgerRoute() {
    return (
        <Suspense fallback={<Fallback />}>
            <Ledger />
        </Suspense>
    );
}

async function Ledger() {
    const user = await getCurrentUser();
    if (!user) redirect('/login?redirect=/work/ledger');
    // 권한이 없으면 경비 화면으로 (API도 403이라 화면은 안내용)
    if (!canWorkDoc(user)) redirect('/work/expense');
    return (
        <>
            <WorkTabs user={user} />
            <LedgerPage />
        </>
    );
}

function Fallback() {
    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
            <Skeleton className="mb-6 h-8 w-40" />
            <Skeleton className="h-96 w-full" />
        </main>
    );
}
