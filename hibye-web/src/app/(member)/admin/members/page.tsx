import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { MembersScreen } from '@/components/admin/UserScreens';
import { Skeleton } from '@/components/ui/Skeleton';
import { requireAdminPage } from '@/lib/adminPage';

export const metadata: Metadata = { title: '직원 관리 — 관리 — hibye' };

// /admin/members — 관리자 전용 (홈페이지 권한자는 문의함으로)
export default function Page() {
    return (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Body />
        </Suspense>
    );
}

async function Body() {
    const user = await requireAdminPage();
    return (
        <>
            <AdminHeading title="직원 관리" desc="직원 정보·권한·상태를 관리해요. 모든 조치는 #hibye-관리에 기록돼요." />
            <MembersScreen myUserId={user.user_id} />
        </>
    );
}
