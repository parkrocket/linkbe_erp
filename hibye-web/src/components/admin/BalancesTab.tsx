'use client';

import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api';
import { adminErrorMessage } from '@/lib/authMessages';
import { balanceErrors, diffBalances, type BalanceDraft, type BalanceRow } from '@/lib/balance';
import { saveBalances } from './adminApi';
import { BalanceHistory, describeChange } from './BalanceHistory';

type Kind = 'stip' | 'vaca';
const CURRENT: Record<Kind, (row: BalanceRow) => number | null> = {
    stip: r => r.user_stip,
    vaca: r => r.user_vaca,
};

// 연차·휴가 탭 — 표에서 여러 명 덮어쓰기 → 사유 → 확인 → 한 번에 저장 (스펙 4장)
export function BalancesTab() {
    const { state, reload } = useApiData<{ users?: BalanceRow[] }>('/api/admin/balances', undefined, 'GET');
    const [draft, setDraft] = useState<BalanceDraft>({});
    const [reason, setReason] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{
        tone: 'ok' | 'error';
        text: string;
    } | null>(null);
    const [historyOf, setHistoryOf] = useState<BalanceRow | null>(null);

    if (state.status === 'loading') return <Skeleton className="h-48 w-full" />;
    if (state.status === 'error') return <ErrorState onRetry={reload} />;

    const rows = state.data.users ?? [];
    const changes = diffBalances(rows, draft);
    const valueOf = (row: BalanceRow, kind: Kind) => draft[row.mb_no]?.[kind] ?? String(CURRENT[kind](row) ?? 0);
    const errorOf = (row: BalanceRow, kind: Kind) => balanceErrors(row, draft[row.mb_no])[kind];
    const hasError = rows.some(r => errorOf(r, 'stip') || errorOf(r, 'vaca'));
    const canSave = changes.length > 0 && !hasError && reason.trim().length > 0;

    const edit = (mbNo: number, kind: Kind, value: string) => setDraft(d => ({ ...d, [mbNo]: { ...d[mbNo], [kind]: value } }));
    const resetDraft = () => {
        setDraft({});
        setReason('');
    };

    const save = async () => {
        setSaving(true);
        setNotice(null);
        try {
            const result = await saveBalances(reason.trim(), changes);
            setNotice({
                tone: 'ok',
                text: `${result.changed}명의 연차·휴가를 저장했어요.`,
            });
            resetDraft();
            reload();
        } catch (error) {
            setNotice({ tone: 'error', text: adminErrorMessage(error) });
            // 그 사이 잔여가 바뀜 → 입력값은 버리고 최신 값으로 (덮어쓰기 사고 방지)
            if (error instanceof ApiError && error.reason === 'Balance changed') {
                resetDraft();
                reload();
            }
        } finally {
            setSaving(false);
            setConfirming(false);
        }
    };

    return (
        <>
            {notice && (
                <p
                    role={notice.tone === 'error' ? 'alert' : 'status'}
                    className={`mb-3 rounded-lg px-3 py-2.5 text-sm ${
                        notice.tone === 'error' ? 'bg-rejected-bg text-rejected-fg' : 'bg-approved-bg text-approved-fg'
                    }`}
                >
                    {notice.text}
                </p>
            )}
            <p className="mb-3 text-xs text-muted">입력한 값으로 남은 일수를 덮어써요. 연차는 0.5일 단위, 휴가는 하루 단위예요.</p>

            {!rows.length ? (
                <EmptyState message="승인된 직원이 없어요" />
            ) : (
                <ul className="divide-y divide-line">
                    {rows.map(row => (
                        <li key={row.mb_no} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
                            <div className="min-w-40 flex-1">
                                <p className="text-sm font-bold">{row.user_name}</p>
                                <p className="truncate text-xs text-muted">{row.user_id}</p>
                            </div>
                            {(['stip', 'vaca'] as const).map(kind => (
                                <BalanceInput
                                    key={kind}
                                    id={`balance-${row.mb_no}-${kind}`}
                                    label={kind === 'stip' ? '연차' : '휴가'}
                                    step={kind === 'stip' ? 0.5 : 1}
                                    value={valueOf(row, kind)}
                                    changed={draft[row.mb_no]?.[kind] !== undefined && Number(valueOf(row, kind)) !== CURRENT[kind](row)}
                                    error={errorOf(row, kind)}
                                    onChange={value => edit(row.mb_no, kind, value)}
                                />
                            ))}
                            <Button variant="ghost" className="self-end" onClick={() => setHistoryOf(row)}>
                                이력
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            {(changes.length > 0 || hasError) && (
                <div className="sticky bottom-0 mt-3 flex flex-wrap items-center gap-2 border-t border-line bg-white py-3">
                    <span className="text-sm font-bold text-primary">{changes.length}명 변경됨</span>
                    <input
                        aria-label="변경 사유"
                        placeholder="사유 (예: 2027년 연차 부여)"
                        maxLength={200}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        className="min-w-48 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft"
                    />
                    <Button variant="secondary" onClick={resetDraft}>
                        되돌리기
                    </Button>
                    <Button disabled={!canSave} onClick={() => setConfirming(true)}>
                        저장
                    </Button>
                </div>
            )}

            <Modal open={confirming} title="이대로 저장할까요?" onClose={() => !saving && setConfirming(false)}>
                <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto text-sm">
                    {changes.map(c => (
                        <li key={c.mbNo} className="flex flex-wrap gap-x-2">
                            <span className="font-bold">{c.name}</span>
                            <span>
                                {[describeChange('연차', c.expectedStip, c.stip), describeChange('휴가', c.expectedVaca, c.vaca)]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </span>
                        </li>
                    ))}
                </ul>
                <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-sm">사유: {reason.trim()}</p>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="secondary" disabled={saving} onClick={() => setConfirming(false)}>
                        취소
                    </Button>
                    <Button disabled={saving} onClick={save}>
                        {saving ? '저장 중…' : '확정'}
                    </Button>
                </div>
            </Modal>

            {historyOf && <BalanceHistory member={historyOf} onClose={() => setHistoryOf(null)} />}
        </>
    );
}

type InputProps = {
    id: string;
    label: string;
    step: number;
    value: string;
    changed: boolean;
    error: string | null;
    onChange: (value: string) => void;
};

function BalanceInput({ id, label, step, value, changed, error, onChange }: InputProps) {
    return (
        <label className="flex w-24 flex-col gap-1 text-xs text-muted">
            {label}
            <input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                max={365}
                step={step}
                value={value}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={e => onChange(e.target.value)}
                className={`w-full rounded-lg border px-2.5 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary-soft ${
                    error ? 'border-rejected-fg' : changed ? 'border-primary bg-primary-soft font-bold' : 'border-line bg-white'
                }`}
            />
            {error && (
                <span id={`${id}-error`} className="text-rejected-fg">
                    {error}
                </span>
            )}
        </label>
    );
}
