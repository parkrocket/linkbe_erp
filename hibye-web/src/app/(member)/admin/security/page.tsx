import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { SecretKeyPanel } from '@/components/admin/SecretKeyPanel';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { requireAdminPage } from '@/lib/adminPage';

export const metadata: Metadata = { title: '암호화 키 — 관리 — hibye' };

// /admin/security — 관리자 전용 (홈페이지 권한자는 문의함으로)
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
            <AdminHeading title="암호화 키" desc="거래처 접속정보 암호화 키를 확인해요(관리자 비밀번호 확인 필요)." />
            <Card><SecretKeyPanel /></Card>
        </>
    );
}
