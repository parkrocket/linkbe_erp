import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { SettingsPage } from '@/components/work/settings/SettingsPage';
import { WorkTabs } from '@/components/work/WorkTabs';
import { getCurrentUser } from '@/lib/auth';
import { canWorkDoc } from '@/lib/workDoc';

export const metadata: Metadata = { title: '업무 설정 — hibye' };

// /work/settings — 분류·품목 문구·양식 설정 (업무 문서 권한자만)
export default function SettingsRoute() {
    return (
        <Suspense fallback={<Fallback />}>
            <Settings />
        </Suspense>
    );
}

async function Settings() {
    const user = await getCurrentUser();
    if (!user) redirect('/login?redirect=/work/settings');
    // 권한이 없으면 경비 화면으로 (API도 403이라 화면은 안내용)
    if (!canWorkDoc(user)) redirect('/work/expense');
    return (
        <>
            <WorkTabs user={user} />
            <SettingsPage />
        </>
    );
}

function Fallback() {
    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
            <Skeleton className="mb-6 h-8 w-40" />
            <Skeleton className="h-96 w-full" />
        </main>
    );
}
