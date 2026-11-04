import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { ContractView } from '@/components/work/contract/ContractView';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canWorkDoc } from '@/lib/workDoc';

export const metadata: Metadata = { title: '견적·계약서 — hibye' };

// /work/contracts/[id] — 상세(보기·수정·삭제)
export default function ContractRoute({ params }: { params: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 w-full max-w-5xl" />}>
            <Contract params={params} />
        </Suspense>
    );
}

async function Contract({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) redirect(`/login?redirect=/work/contracts/${encodeURIComponent(id)}`);
    if (!canWorkDoc(user)) redirect('/work/expense');
    return (
        <>
            <WorkTabs user={user} />
            <ContractView id={id} />
        </>
    );
}
