import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { BoardView } from '@/components/work/board/BoardView';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canWorkDoc } from '@/lib/workDoc';

export const metadata: Metadata = { title: '바이럴 — hibye' };

// /work/viral/[id] — 글 보기·댓글·수정·삭제
export default function ViralPostRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    return (
        <Suspense
            fallback={
                <Skeleton className="mx-auto mt-10 h-96 w-full max-w-5xl" />
            }
        >
            <ViralPost params={params} />
        </Suspense>
    );
}

async function ViralPost({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user)
        redirect(`/login?redirect=/work/viral/${encodeURIComponent(id)}`);
    if (!canWorkDoc(user)) redirect('/work/expense');
    return (
        <>
            <WorkTabs user={user} />
            <BoardView id={id} />
        </>
    );
}
