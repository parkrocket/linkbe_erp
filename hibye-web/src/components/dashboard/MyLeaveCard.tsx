'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { upcomingLeaves } from '@/lib/leave';
import type { User, VacationRecord } from '@/lib/types';
import { LeaveBadge } from './LeaveBadge';
import { todayString, useApiData } from './useApiData';

type Response = { vacationList?: VacationRecord[] };

const DAY_LABEL = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

// DECIMAL 문자열('8.5')·null 대응
const days = (value: User['user_stip']) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

export function MyLeaveCard({ user }: { user: User }) {
    // 서버가 토큰 주인 기준으로 조회하므로 바디는 비움
    const { state, reload } = useApiData<Response>('/api/vacation/list', {});

    return (
        <Card title="내 근태">
            <dl className="grid grid-cols-2 gap-3">
                <Balance label="남은 연차" value={days(user.user_stip)} />
                <Balance label="남은 휴가" value={days(user.user_vaca)} />
            </dl>

            <div className="mt-5 mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">다가오는 일정</h3>
                <Link href="/vaca" className="text-xs text-muted hover:text-ink">
                    전체 ›
                </Link>
            </div>
            {state.status === 'loading' && <Skeleton className="h-24 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' && <Upcoming list={upcomingLeaves(state.data.vacationList ?? [], todayString())} />}
        </Card>
    );
}

function Balance({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-extrabold text-ink tabular-nums">
                {value}
                <span className="ml-0.5 text-sm font-medium text-muted">일</span>
            </dd>
        </div>
    );
}

function Upcoming({ list }: { list: VacationRecord[] }) {
    if (!list.length) return <EmptyState message="예정된 근태가 없어요" />;
    return (
        <ul className="divide-y divide-line">
            {list.map((v, i) => (
                <li key={v.id ?? `${v.date}-${i}`} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-ink">{DAY_LABEL.format(new Date(v.date))}</span>
                    <LeaveBadge type={v.type} />
                </li>
            ))}
        </ul>
    );
}
