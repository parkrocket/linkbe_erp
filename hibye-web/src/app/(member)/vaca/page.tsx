import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LeavePage } from '@/components/leave/LeavePage';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: '근태 — hibye' };

// /vaca — 근태 신청·내역. ?new=1이면 신청 창을 바로 엶 (대시보드 [근태 신청])
export default function VacaPage({ searchParams }: PageProps<'/vaca'>) {
    return (
        <Suspense fallback={<VacaFallback />}>
            <Vaca searchParams={searchParams} />
        </Suspense>
    );
}

async function Vaca({ searchParams }: { searchParams: PageProps<'/vaca'>['searchParams'] }) {
    const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
    // proxy는 쿠키 유무만 보므로, 만료 토큰이면 여기서 로그인으로
    if (!user) redirect('/login?redirect=/vaca');
    return <LeavePage user={user} openApply={params.new === '1'} />;
}

function VacaFallback() {
    return (
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
            <Skeleton className="mb-6 h-8 w-40" />
            <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
            <Skeleton className="mt-4 h-48" />
        </main>
    );
}
