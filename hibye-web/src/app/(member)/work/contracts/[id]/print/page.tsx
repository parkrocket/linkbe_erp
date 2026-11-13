import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { PrintView } from '@/components/work/contract/PrintView';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canWorkDoc } from '@/lib/workDoc';

export const metadata: Metadata = { title: '견적서·계약서 인쇄 — hibye' };

type Props = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ kind?: string; template?: string }>;
};

// /work/contracts/[id]/print?kind=estimate|contract&template=양식id — 양식 미리보기·인쇄
export default function PrintRoute({ params, searchParams }: Props) {
    return (
        <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 w-full max-w-page" />}>
            <Print params={params} searchParams={searchParams} />
        </Suspense>
    );
}

async function Print({ params, searchParams }: Props) {
    const { id } = await params;
    const { kind, template } = await searchParams;
    const user = await getCurrentUser();
    if (!user) redirect(`/login?redirect=/work/contracts/${encodeURIComponent(id)}/print`);
    if (!canWorkDoc(user)) redirect('/work/expense');
    // kind가 이상하면 견적서, template이 숫자가 아니면 기본 양식
    const templateId = /^\d+$/.test(template || '') ? Number(template) : null;
    return (
        <>
            <WorkTabs user={user} />
            <PrintView id={id} kind={kind === 'contract' ? 'contract' : 'estimate'} templateId={templateId} />
        </>
    );
}
