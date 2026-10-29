'use client';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LEAVE_TYPES, summarizeTeamLeave, type TeamLeave } from '@/lib/leave';
import type { GtwRecord } from '@/lib/types';
import { LeaveBadge } from './LeaveBadge';
import { todayString, useApiData } from './useApiData';

type Response = { gtw?: GtwRecord[] };

export function TeamLeaveCard({ cpId }: { cpId: number }) {
    const { state, reload } = useApiData<Response>('/api/gtw/gtwStatusAll', { date: todayString(), cpId });
    const summary = state.status === 'ok' ? summarizeTeamLeave(state.data.gtw ?? []) : null;

    return (
        <Card
            title="오늘 팀 근태"
            action={
                summary && (
                    <span className="text-xs text-muted">
                        전체 {summary.total}명 중 {summary.people.length}명
                    </span>
                )
            }
        >
            {state.status === 'loading' && <Skeleton className="h-40 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {summary && <TeamLeaveBody summary={summary} />}
        </Card>
    );
}

function TeamLeaveBody({ summary }: { summary: TeamLeave }) {
    return (
        <>
            {/* 숫자는 기본 글자색, 종류는 라벨로 */}
            <dl className="grid grid-cols-4 gap-2">
                {LEAVE_TYPES.map(({ type, label }) => (
                    <div key={type} className="rounded-lg bg-surface px-3 py-2.5">
                        <dt className="text-xs text-muted">{label}</dt>
                        <dd className="mt-0.5 text-xl font-extrabold text-ink tabular-nums">{summary.counts[type]}</dd>
                    </div>
                ))}
            </dl>
            {summary.people.length ? (
                <ul className="mt-3 divide-y divide-line">
                    {summary.people.map((p, i) => (
                        <li key={`${p.name}-${i}`} className="flex items-center justify-between py-2.5 text-sm">
                            <span className="text-ink">{p.name}</span>
                            <LeaveBadge type={p.type} />
                        </li>
                    ))}
                </ul>
            ) : (
                <EmptyState message="오늘은 모두 정상 근무예요" />
            )}
        </>
    );
}
