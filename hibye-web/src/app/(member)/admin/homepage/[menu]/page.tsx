import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AdminHeading } from '@/components/admin/AdminHeading';
import { HomepagePanel } from '@/components/admin/homepage/HomepageTab';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { HOMEPAGE_MENUS, isHomepageMenu } from '@/lib/adminNav';

type Params = Promise<{ menu: string }>;

// 브라우저 탭 제목에 메뉴 이름(문의함·주문 등) — 탭 여러 개를 띄워도 구분되게
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { menu } = await params;
    const label = HOMEPAGE_MENUS.find(m => m.key === menu)?.label ?? '홈페이지';
    return { title: `${label} — 관리 — hibye` };
}

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
