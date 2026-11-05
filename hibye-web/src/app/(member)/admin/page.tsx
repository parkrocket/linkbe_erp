import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { Skeleton } from '@/components/ui/Skeleton';
import { legacyAdminPath } from '@/lib/adminNav';
import { requireAdminPage } from '@/lib/adminPage';

export const metadata: Metadata = { title: '관리 — hibye' };

// /admin — 대시보드(처리할 일). 예전 주소 /admin?tab=<탭>은 새 주소로
export default function AdminRoute({ searchParams }: PageProps<'/admin'>) {
    return (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Dashboard searchParams={searchParams} />
        </Suspense>
    );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<'/admin'>['searchParams'] }) {
    const { tab } = await searchParams;
    const legacy = legacyAdminPath(typeof tab === 'string' ? tab : undefined);
    if (legacy) redirect(legacy);
    await requireAdminPage();
    return <AdminHeading title="대시보드" desc="처리할 일을 한눈에 봐요." />;
}
