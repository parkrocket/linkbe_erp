import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { OrgTab } from '@/components/admin/OrgTab';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { requireAdminPage } from '@/lib/adminPage';

export const metadata: Metadata = { title: '조직 — 관리 — hibye' };

// /admin/org — 관리자 전용 (홈페이지 권한자는 문의함으로)
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
            <AdminHeading title="조직" desc="부서와 직급을 관리해요." />
            <Card><OrgTab /></Card>
        </>
    );
}
