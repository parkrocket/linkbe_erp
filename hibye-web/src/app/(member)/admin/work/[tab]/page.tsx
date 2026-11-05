import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { SettingsPanel } from '@/components/work/settings/SettingsPage';
import { isWorkSettingsTab, WORK_SETTINGS } from '@/lib/adminNav';
import { requireAdminPage } from '@/lib/adminPage';

type Params = Promise<{ tab: string }>;

export const metadata: Metadata = { title: '업무 설정 — 관리 — hibye' };

const DESC: Record<string, string> = {
    categories: '견적·계약서 분류(유지보수·서버 운영 등)를 관리해요.',
    items: '견적·계약서 품목에 자주 쓰는 문구를 관리해요.',
    docs: '견적서·계약서 인쇄 양식을 관리해요.',
    accounts: '매출/매입 장부의 계정과목을 관리해요.',
};

// /admin/work/<탭> — 업무 설정(관리자 전용). 없는 탭은 404
export default function Page({ params }: { params: Params }) {
    return (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Body params={params} />
        </Suspense>
    );
}

async function Body({ params }: { params: Params }) {
    await requireAdminPage();
    const { tab } = await params;
    if (!isWorkSettingsTab(tab)) notFound();
    const label = WORK_SETTINGS.find(m => m.key === tab)?.label ?? '';
    return (
        <>
            <AdminHeading title={label} desc={DESC[tab]} />
            <Card>
                <SettingsPanel tab={tab} />
            </Card>
        </>
    );
}
