import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SchedulePage } from '@/components/schedule/SchedulePage';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: '일정 — hibye' };

// /calendar — 회사 일정(Google 캘린더)·공휴일·근태 월 달력
export default function CalendarPage() {
    return (
        <Suspense fallback={<CalendarFallback />}>
            <Calendar />
        </Suspense>
    );
}

async function Calendar() {
    // proxy는 쿠키 유무만 보므로, 만료 토큰이면 여기서 로그인으로
    if (!(await getCurrentUser())) redirect('/login?redirect=/calendar');
    return <SchedulePage />;
}

function CalendarFallback() {
    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
            <Skeleton className="mb-6 h-8 w-40" />
            <Skeleton className="h-[32rem] w-full" />
        </main>
    );
}
