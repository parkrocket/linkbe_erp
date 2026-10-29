'use client';

import { Building2, Clock4, House, LogOut, Palmtree } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { GtwRecord } from '@/lib/types';
import { summarizeWorkStatus, type WorkSummary } from '@/lib/work';
import { todayString, useApiData } from './useApiData';

type Response = { gtw?: GtwRecord[] };

// 숫자는 기본 글자색, 의미는 아이콘+라벨로 (색만으로 구분하지 않음)
const TILES: { key: keyof WorkSummary; label: string; icon: LucideIcon }[] = [
    { key: 'office', label: '사무실', icon: Building2 },
    { key: 'home', label: '재택', icon: House },
    { key: 'vacation', label: '휴가', icon: Palmtree },
    { key: 'late', label: '지각', icon: Clock4 },
    { key: 'left', label: '퇴근', icon: LogOut },
];

export function CompanyStatusCard({ cpId }: { cpId: number }) {
    const date = todayString();
    const { state, reload } = useApiData<Response>('/api/gtw/gtwStatusAll', { date, cpId });

    return (
        <Card title="회사 근무 현황">
            {state.status === 'loading' && <Skeleton className="h-24 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (state.data.gtw?.length ? (
                    <Tiles summary={summarizeWorkStatus(state.data.gtw, date)} total={state.data.gtw.length} />
                ) : (
                    <EmptyState message="등록된 구성원이 없어요" />
                ))}
        </Card>
    );
}

function Tiles({ summary, total }: { summary: WorkSummary; total: number }) {
    return (
        <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {TILES.map(({ key, label, icon: Icon }) => (
                    <li key={key} className="rounded-lg bg-surface px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                            <Icon aria-hidden className="size-3.5" />
                            {label}
                        </span>
                        <span className="mt-1 block text-2xl font-extrabold text-ink tabular-nums">
                            {summary[key]}
                            <span className="ml-0.5 text-sm font-medium text-muted">명</span>
                        </span>
                    </li>
                ))}
            </ul>
            <p className="mt-3 text-xs text-muted">전체 {total}명 · 지각은 10시 1분 이후 출근 기준</p>
        </>
    );
}
