'use client';

import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { NoticeLine } from './HomepageTab';
import { Pager } from './Pager';
import {
    homepageErrorMessage,
    customersPath,
    leaveCustomer,
    type Customer,
} from './homepageApi';

const DAY = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
});
const day = (v: string | null) => (v ? DAY.format(new Date(v)) : '—');
const TH = 'px-2 py-2 text-left font-medium text-muted';
const TD = 'px-2 py-2.5';

// 고객 회원 — 개인결제 사이트 가입자 목록·검색·대신 탈퇴 (비밀번호 기능 없음)
export function CustomersPanel() {
    const [input, setInput] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [notice, setNotice] = useState<{
        tone: 'ok' | 'error';
        text: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const { state, reload, refresh } = useApiData<{
        members?: Customer[];
        total?: number;
    }>(customersPath({ q, page }), undefined, 'GET');
    const members = state.status === 'ok' ? (state.data.members ?? []) : [];

    const leave = async (m: Customer) => {
        if (
            !window.confirm(
                `${m.name}님을 탈퇴 처리할까요? 아이디·비밀번호·연락처가 바로 지워지고 되돌릴 수 없어요.`,
            )
        )
            return;
        setBusy(true);
        setNotice(null);
        try {
            await leaveCustomer(m.id);
            setNotice({ tone: 'ok', text: `${m.name}님을 탈퇴 처리했어요.` });
        } catch (e) {
            const gone = e instanceof ApiError && e.status === 404;
            setNotice({
                tone: 'error',
                text: gone
                    ? '이미 탈퇴했거나 없는 회원이에요.'
                    : homepageErrorMessage(e),
            });
        } finally {
            setBusy(false);
            refresh();
        }
    };

    return (
        <>
            <form
                className="mb-3 flex gap-2"
                onSubmit={e => {
                    e.preventDefault();
                    setQ(input.trim());
                    setPage(1);
                }}
            >
                <input
                    type="search"
                    aria-label="검색"
                    placeholder="아이디·이름·이메일"
                    maxLength={50}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft"
                />
                <Button type="submit" variant="secondary">
                    검색
                </Button>
            </form>
            <NoticeLine notice={notice} />
            {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (!members.length ? (
                    <EmptyState message="고객 회원이 없어요" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-line">
                                    <th className={TH}>아이디</th>
                                    <th className={TH}>이름</th>
                                    <th className={TH}>이메일</th>
                                    <th className={TH}>가입일</th>
                                    <th className={TH}>마지막 로그인</th>
                                    <th className={`${TH} text-right`}>
                                        주문 수
                                    </th>
                                    <th className={TH}>상태</th>
                                    <th className={TH}>
                                        <span className="sr-only">
                                            탈퇴 처리
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {members.map(m => (
                                    <tr key={m.id}>
                                        <td className={TD}>
                                            {m.loginId || '—'}
                                        </td>
                                        <td className={TD}>{m.name}</td>
                                        <td className={TD}>{m.email || '—'}</td>
                                        <td className={TD}>
                                            {day(m.createdAt)}
                                        </td>
                                        <td className={TD}>
                                            {day(m.lastLoginAt)}
                                        </td>
                                        <td
                                            className={`${TD} text-right tabular-nums`}
                                        >
                                            {m.orderCount}
                                        </td>
                                        <td className={TD}>
                                            {m.status === 'left' ? (
                                                <Badge tone="neutral">
                                                    탈퇴
                                                </Badge>
                                            ) : (
                                                <Badge tone="approved">
                                                    활동
                                                </Badge>
                                            )}
                                        </td>
                                        <td className={`${TD} text-right`}>
                                            {m.status === 'active' && (
                                                <Button
                                                    variant="secondary"
                                                    disabled={busy}
                                                    onClick={() => leave(m)}
                                                >
                                                    탈퇴
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            {state.status === 'ok' && (
                <Pager
                    page={page}
                    total={state.data.total ?? 0}
                    onPage={setPage}
                />
            )}
        </>
    );
}
