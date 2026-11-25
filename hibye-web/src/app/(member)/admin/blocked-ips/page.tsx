import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { BlockedIpsPanel } from '@/components/admin/BlockedIpsPanel';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { requireAdminPage } from '@/lib/adminPage';

export const metadata: Metadata = { title: '차단 IP — 관리 — hibye' };

// /admin/blocked-ips — 관리자 전용 (홈페이지 권한자는 문의함으로)
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
            <AdminHeading title="차단 IP" desc="hibye.kr에 들어올 수 없게 막은 IP예요. 직원 관리 목록의 차단 아이콘으로도 추가돼요." />
            <Card>
                <BlockedIpsPanel />
            </Card>
        </>
    );
}
