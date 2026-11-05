import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { LeavesTab } from '@/components/admin/LeavesTab';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { requireAdminPage } from '@/lib/adminPage';

export const metadata: Metadata = { title: '근태 — 관리 — hibye' };

// /admin/leaves — 관리자 전용 (홈페이지 권한자는 문의함으로)
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
            <AdminHeading title="근태" desc="월별 근태를 보고, 오늘 이후 근태를 대신 취소해요." />
            <Card><LeavesTab /></Card>
        </>
    );
}
