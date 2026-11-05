import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { BalancesTab } from '@/components/admin/BalancesTab';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { requireAdminPage } from '@/lib/adminPage';

export const metadata: Metadata = { title: '연차·휴가 — 관리 — hibye' };

// /admin/balances — 관리자 전용 (홈페이지 권한자는 문의함으로)
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
            <AdminHeading title="연차·휴가" desc="남은 연차·휴가 일수를 덮어쓰고 이력을 확인해요." />
            <Card><BalancesTab /></Card>
        </>
    );
}
