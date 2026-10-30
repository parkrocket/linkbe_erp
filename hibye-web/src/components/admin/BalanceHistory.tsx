'use client';

import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { actorLabel, LOG_KIND_LABEL, type BalanceLogRow, type BalanceRow } from '@/lib/balance';

const KIND_TONE: Record<BalanceLogRow['kind'], BadgeTone> = {
    admin: 'info',
    apply: 'neutral',
    cancel: 'pending',
    grant: 'approved',
};

const WHEN = new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

// '연차 2.5 → 15' — 값이 그대로면 null (바뀐 쪽만 보여줌)
export function describeChange(label: string, before: number | null, after: number | null) {
    return before === after ? null : `${label} ${before ?? '-'} → ${after ?? '-'}`;
}

// 직원 한 명의 잔여 변경 이력 (관리자 조정·신청·취소, 최근순)
export function BalanceHistory({ member, onClose }: { member: BalanceRow; onClose: () => void }) {
    const { state, reload } = useApiData<{ logs?: BalanceLogRow[] }>(`/api/admin/balances/${member.mb_no}/logs`, undefined, 'GET');
    const logs = state.status === 'ok' ? (state.data.logs ?? []) : [];

    return (
        <Modal open title={`${member.user_name}님 변경 이력`} onClose={onClose}>
            {state.status === 'loading' && <Skeleton className="h-32 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (!logs.length ? (
                    <EmptyState message="아직 변경 이력이 없어요" />
                ) : (
                    <ul className="divide-y divide-line">
                        {logs.map(log => (
                            <li key={log.id} className="py-3 text-sm">
                                <p className="flex flex-wrap items-center gap-1.5">
                                    <Badge tone={KIND_TONE[log.kind]}>{LOG_KIND_LABEL[log.kind]}</Badge>
                                    <span className="font-semibold">
                                        {[
                                            describeChange('연차', log.stip_before, log.stip_after),
                                            describeChange('휴가', log.vaca_before, log.vaca_after),
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                </p>
                                <p className="mt-1 break-words text-muted">{log.memo}</p>
                                <p className="mt-0.5 text-xs text-muted">
                                    {WHEN.format(new Date(log.created_at))} · {actorLabel(log)}
                                </p>
                            </li>
                        ))}
                    </ul>
                ))}
        </Modal>
    );
}
