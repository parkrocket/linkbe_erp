import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { ClientList } from '@/components/work/clients/ClientList';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canClientSecret } from '@/lib/workDoc';

export const metadata: Metadata = { title: '거래처 접속정보 — hibye' };

// /work/clients — 업체 목록 (접속정보 권한자만)
export default function ClientsRoute() {
    return (
        <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 w-full max-w-page" />}>
            <Clients />
        </Suspense>
    );
}

async function Clients() {
    const user = await getCurrentUser();
    if (!user) redirect('/login?redirect=/work/clients');
    // 권한이 없으면 경비 화면으로 (API도 403이라 화면은 안내용)
    if (!canClientSecret(user)) redirect('/work/expense');
    return (
        <>
            <WorkTabs user={user} />
            <ClientList />
        </>
    );
}
