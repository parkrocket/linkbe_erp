import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { HomepagePanel } from '@/components/admin/homepage/HomepageTab';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { HOMEPAGE_MENUS, isHomepageMenu } from '@/lib/adminNav';

type Params = Promise<{ menu: string }>;

export const metadata: Metadata = { title: '홈페이지 — 관리 — hibye' };

// /admin/homepage/<메뉴> — 관리자·홈페이지 권한자(layout이 확인). 없는 메뉴는 404
export default function Page({ params }: { params: Params }) {
    return (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Body params={params} />
        </Suspense>
    );
}

async function Body({ params }: { params: Params }) {
    const { menu } = await params;
    if (!isHomepageMenu(menu)) notFound();
    const label = HOMEPAGE_MENUS.find(m => m.key === menu)?.label ?? '';
    return (
        <>
            <AdminHeading title={label} desc="linkbe.kr 홈페이지 내용을 관리해요." />
            <Card>
                <HomepagePanel menu={menu} />
            </Card>
        </>
    );
}
