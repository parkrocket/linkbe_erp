import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { ClientDetail } from '@/components/work/clients/ClientDetail';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canClientSecret } from '@/lib/workDoc';

export const metadata: Metadata = { title: '거래처 접속정보 — hibye' };

// /work/clients/[id] — 업체 상세 (항목·첨부·기록)
export default function ClientRoute({ params }: { params: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 w-full max-w-page" />}>
            <Client params={params} />
        </Suspense>
    );
}

async function Client({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) redirect(`/login?redirect=/work/clients/${encodeURIComponent(id)}`);
    if (!canClientSecret(user)) redirect('/work/expense');
    return (
        <>
            <WorkTabs user={user} />
            <ClientDetail key={id} id={id} />
        </>
    );
}
