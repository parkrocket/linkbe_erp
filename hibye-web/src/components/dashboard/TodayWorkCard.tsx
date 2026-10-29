'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { GtwRecord } from '@/lib/types';
import { todayWorkProgress } from '@/lib/work';
import { todayString, useApiData } from './useApiData';

type Response = { gtw?: GtwRecord };

const timeOf = (iso: string) =>
    new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

export function TodayWorkCard({ userId }: { userId: string }) {
    const { state, reload } = useApiData<Response>('/api/gtw/gtwStatus', { userId, date: todayString() });
    // 근무 시간·진행률을 1분마다 갱신
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    return (
        <Card title="오늘 근무" action={state.status === 'ok' && <StatusBadge gtw={state.data.gtw} />}>
            {state.status === 'loading' && <Skeleton className="h-32 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' && <TodayWorkBody gtw={state.data.gtw} now={now} />}
        </Card>
    );
}

function StatusBadge({ gtw }: { gtw?: GtwRecord }) {
    if (!gtw?.start_time) return <Badge tone="neutral">출근 전</Badge>;
    if (gtw.end_time) return <Badge tone="approved">퇴근 완료</Badge>;
    return <Badge tone="info">출근 중 · {gtw.gtw_location === 'home' ? '재택' : '사무실'}</Badge>;
}

function TodayWorkBody({ gtw, now }: { gtw?: GtwRecord; now: Date }) {
    const start = gtw?.start_time ?? null;
    const end = gtw?.end_time ?? null;
    const { workedMinutes, expectedEnd, percent } = todayWorkProgress(start, end, now);
    const hours = Math.floor(workedMinutes / 60);
    const minutes = workedMinutes % 60;

    return (
        <div>
            <dl className="grid grid-cols-3 gap-4">
                <div>
                    <dt className="text-xs text-muted">출근</dt>
                    <dd className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{start ? timeOf(start) : '--:--'}</dd>
                </div>
                <div>
                    <dt className="text-xs text-muted">{end ? '퇴근' : '예상 퇴근'}</dt>
                    <dd className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{expectedEnd ?? '--:--'}</dd>
                </div>
                <div>
                    <dt className="text-xs text-muted">근무 시간</dt>
                    <dd className="mt-1 text-2xl font-extrabold text-ink tabular-nums">
                        {start ? `${hours}시간 ${minutes}분` : '-'}
                    </dd>
                </div>
            </dl>

            <div
                role="progressbar"
                aria-label="오늘 근무 진행률 (9시간 기준)"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="mt-5 h-2 w-full overflow-hidden rounded-full bg-line"
            >
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1 text-right text-xs text-muted tabular-nums">{percent}%</p>

            {/* 웹 출근 API 없음 — 자리만 두고 안내 (스펙: 준비 중) */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="secondary" disabled className="sm:w-auto">
                    {start && !end ? '퇴근하기' : '출근하기'}
                </Button>
                <p className="text-xs text-muted">웹 출근은 준비 중이에요 · Slack에서 출근해 주세요</p>
            </div>
        </div>
    );
}
