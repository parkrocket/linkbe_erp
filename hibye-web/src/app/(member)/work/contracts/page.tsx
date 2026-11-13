import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { ContractList } from '@/components/work/contract/ContractList';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canWorkDoc } from '@/lib/workDoc';

export const metadata: Metadata = { title: '견적·계약서 — hibye' };

// /work/contracts — 견적·계약서 목록 (업무 문서 권한자만)
export default function ContractsRoute() {
    return (
        <Suspense fallback={<Fallback />}>
            <Contracts />
        </Suspense>
    );
}

async function Contracts() {
    const user = await getCurrentUser();
    if (!user) redirect('/login?redirect=/work/contracts');
    // 권한이 없으면 경비 화면으로 (API도 403이라 화면은 안내용)
    if (!canWorkDoc(user)) redirect('/work/expense');
    return (
        <>
            <WorkTabs user={user} />
            <ContractList />
        </>
    );
}

function Fallback() {
    return (
        <main className="mx-auto w-full max-w-page flex-1 px-4 py-10">
            <Skeleton className="mb-6 h-8 w-40" />
            <Skeleton className="h-96 w-full" />
        </main>
    );
}
