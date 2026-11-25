'use client';

import { useState, type FormEvent } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { adminErrorMessage } from '@/lib/authMessages';
import { blockIp, unblockIp, type BlockedIp } from './adminApi';

// hibye.kr 접속 차단 IP — 목록·직접 추가·해제 (linkbe.kr은 막지 않음)
export function BlockedIpsPanel() {
    const { state, reload } = useApiData<{ items: BlockedIp[]; myIp: string }>('/api/admin/blocked-ips', undefined, 'GET');
    const [ip, setIp] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

    const act = async (action: () => Promise<unknown>, done: string) => {
        setBusy(true);
        setNotice(null);
        try {
            await action();
            setNotice({ tone: 'ok', text: done });
            reload();
            return true;
        } catch (e) {
            setNotice({ tone: 'error', text: adminErrorMessage(e) });
            return false;
        } finally {
            setBusy(false);
        }
    };

    const add = async (e: FormEvent) => {
        e.preventDefault();
        const v = ip.trim();
        if (!v) return;
        if (await act(() => blockIp(v, reason.trim()), `IP ${v}을(를) 차단했어요.`)) {
            setIp('');
            setReason('');
        }
    };

    const remove = (row: BlockedIp) => {
        if (!window.confirm(`IP ${row.ip} 차단을 해제할까요?`)) return;
        void act(() => unblockIp(row.id), `IP ${row.ip} 차단을 해제했어요.`);
    };

    return (
        <div className="flex flex-col gap-5">
            <form onSubmit={add} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                <TextField label="IP 주소" name="block-ip" value={ip} onChange={e => setIp(e.target.value)} maxLength={45} placeholder="예: 203.0.113.10" autoComplete="off" spellCheck={false} />
                <TextField label="사유 (선택)" name="block-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={200} />
                <Button type="submit" disabled={busy || !ip.trim()}>
                    차단
                </Button>
            </form>
            <p className="-mt-2 text-xs text-muted">
                차단한 IP에서는 hibye.kr 화면과 로그인을 쓸 수 없어요(linkbe.kr은 그대로). 회사 사무실 IP와 지금 내 IP
                {state.status === 'ok' && state.data.myIp ? ` (${state.data.myIp})` : ''}는 차단할 수 없어요. 반영까지 최대 30초 걸릴 수 있어요.
            </p>

            {notice && (
                <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2.5 text-sm ${notice.tone === 'error' ? 'bg-rejected-bg text-rejected-fg' : 'bg-approved-bg text-approved-fg'}`}>
                    {notice.text}
                </p>
            )}

            {state.status === 'loading' && <Skeleton className="h-40 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (state.data.items.length === 0 ? (
                    <EmptyState message="차단된 IP가 없어요" />
                ) : (
                    <ul className="divide-y divide-line">
                        {state.data.items.map(row => (
                            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                                <span className="min-w-0 flex-1">
                                    <span className="font-mono font-bold">{row.ip}</span>
                                    {row.targetName && <span className="ml-2 text-xs text-muted">{row.targetName}님 접속 IP</span>}
                                    <span className="block text-xs text-muted">
                                        {row.createdAt} · {row.creatorName} 차단{row.reason ? ` · ${row.reason}` : ''}
                                    </span>
                                </span>
                                <Button variant="secondary" disabled={busy} onClick={() => remove(row)}>
                                    해제
                                </Button>
                            </li>
                        ))}
                    </ul>
                ))}
        </div>
    );
}
