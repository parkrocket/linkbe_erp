import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { ContractForm } from '@/components/work/contract/ContractForm';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canWorkDoc } from '@/lib/workDoc';

export const metadata: Metadata = { title: '새 계약 — hibye' };

// /work/contracts/new — 새 견적·계약서 작성. ?from=<계약 id>면 그 계약을 복사해 채움
export default function NewContractRoute({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
    return (
        <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 w-full max-w-5xl" />}>
            <NewContract searchParams={searchParams} />
        </Suspense>
    );
}

async function NewContract({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
    const user = await getCurrentUser();
    if (!user) redirect('/login?redirect=/work/contracts/new');
    if (!canWorkDoc(user)) redirect('/work/expense');
    const from = Number((await searchParams).from);
    const copyFromId = Number.isInteger(from) && from > 0 ? from : undefined;
    return (
        <>
            <WorkTabs user={user} />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
                <h1 className="mb-5 text-2xl font-bold">{copyFromId ? '새 계약 (복사)' : '새 계약'}</h1>
                <ContractForm copyFromId={copyFromId} />
            </main>
        </>
    );
}
