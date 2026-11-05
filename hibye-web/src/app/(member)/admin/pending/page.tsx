import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { PendingScreen } from '@/components/admin/UserScreens';
import { Skeleton } from '@/components/ui/Skeleton';
import { requireAdminPage } from '@/lib/adminPage';

export const metadata: Metadata = { title: '가입 승인 — 관리 — hibye' };

// /admin/pending — 관리자 전용 (홈페이지 권한자는 문의함으로)
export default function Page() {
    return (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Body />
        </Suspense>
    );
}

async function Body() {
    await requireAdminPage();
    return (
        <>
            <AdminHeading title="가입 승인" desc="가입 신청을 승인하거나 거절해요. 모든 조치는 #hibye-관리에 기록돼요." />
            <PendingScreen />
        </>
    );
}
