'use client';

import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cancelConfirmText, formatWon, ORDER_STATUS_LABEL, PAY_METHOD_LABEL, type OrderRow, type OrderStatus } from '@/lib/shop';
import { NoticeLine } from './HomepageTab';
import { Pager } from './Pager';
import { cancelOrder, orderAction, ordersPath, saveOrderMemo, shopErrorMessage } from './homepageApi';

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
    pending: 'neutral',
    awaiting_deposit: 'pending',
    paid: 'info',
    completed: 'approved',
    cancelled: 'rejected',
};
const WHEN = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const FIELD =
    'rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';
type Notice = { tone: 'ok' | 'error'; text: string } | null;

// 개인결제 주문 — 필터(상태·수단·기간·검색), 입금 대기 강조
export function OrdersPanel() {
    const [filter, setFilter] = useState({ status: '', payMethod: '', from: '', to: '', q: '' });
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [opened, setOpened] = useState<number | null>(null);
    const [notice, setNotice] = useState<Notice>(null);
    const { state, reload, refresh } = useApiData<{ orders?: OrderRow[]; total?: number }>(
        ordersPath({ ...filter, page }),
        undefined,
        'GET',
    );
    // 입금 대기 건수 — 필터와 무관하게 따로 조회
    const waiting = useApiData<{ awaitingCount?: number }>('/api/admin/shop/summary', undefined, 'GET');
    const awaitingCount = waiting.state.status === 'ok' ? (waiting.state.data.awaitingCount ?? 0) : 0;
    const rows = state.status === 'ok' ? (state.data.orders ?? []) : [];
    const change = (patch: Partial<typeof filter>) => {
        setFilter(prev => ({ ...prev, ...patch }));
        setPage(1);
    };
    const reloadAll = () => {
        refresh();
        waiting.refresh();
    };

    return (
        <>
            <NoticeLine notice={notice} />
            {awaitingCount > 0 && (
                <button
                    type="button"
                    onClick={() => change({ status: 'awaiting_deposit' })}
                    className="mb-3 w-full rounded-lg bg-pending-bg px-3 py-2.5 text-left text-sm font-bold text-pending-fg focus-visible:outline-2 focus-visible:outline-primary"
                >
                    입금 대기 {awaitingCount}건
                </button>
            )}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <select aria-label="상태" className={FIELD} value={filter.status} onChange={e => change({ status: e.target.value })}>
                    <option value="">전체 상태</option>
                    {Object.entries(ORDER_STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                            {l}
                        </option>
                    ))}
                </select>
                <select aria-label="결제 수단" className={FIELD} value={filter.payMethod} onChange={e => change({ payMethod: e.target.value })}>
                    <option value="">전체 수단</option>
                    {(['card', 'bank', 'deposit'] as const).map(v => (
                        <option key={v} value={v}>
                            {PAY_METHOD_LABEL[v]}
                        </option>
                    ))}
                </select>
                <input aria-label="시작일" type="date" className={FIELD} value={filter.from} onChange={e => change({ from: e.target.value })} />
                <span className="text-muted">~</span>
                <input aria-label="종료일" type="date" className={FIELD} value={filter.to} onChange={e => change({ to: e.target.value })} />
                <form
                    className="flex gap-1"
                    onSubmit={e => {
                        e.preventDefault();
                        change({ q: search.trim() });
                    }}
                >
                    <input
                        aria-label="검색"
                        placeholder="주문번호·상품·주문자"
                        maxLength={100}
                        className={FIELD}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <Button type="submit" variant="secondary">
                        검색
                    </Button>
                </form>
            </div>
            {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (!rows.length ? (
                    <EmptyState message="주문이 없어요" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-xs text-muted">
                                <tr>
                                    {['주문번호', '상품', '금액', '수단', '주문자', '상태', '주문일'].map(h => (
                                        <th key={h} scope="col" className="whitespace-nowrap px-2 py-2 font-medium">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {rows.map(r => (
                                    <tr key={r.id} className="hover:bg-surface">
                                        <td className="px-2 py-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setOpened(r.id)}
                                                className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                                            >
                                                {r.orderNo}
                                            </button>
                                        </td>
                                        <td className="max-w-48 truncate px-2 py-2.5">{r.productTitle}</td>
                                        <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">{formatWon(r.amount)}</td>
                                        <td className="whitespace-nowrap px-2 py-2.5">{PAY_METHOD_LABEL[r.payMethod] ?? r.payMethod}</td>
                                        <td className="whitespace-nowrap px-2 py-2.5">{r.buyerName}</td>
                                        <td className="px-2 py-2.5">
                                            <Badge tone={STATUS_TONE[r.status]}>{ORDER_STATUS_LABEL[r.status]}</Badge>
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-muted">{WHEN.format(new Date(r.createdAt))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            {state.status === 'ok' && <Pager page={page} total={state.data.total ?? 0} onPage={setPage} />}
            {opened !== null && <OrderDialog id={opened} onClose={() => setOpened(null)} onChanged={reloadAll} onNotice={setNotice} />}
        </>
    );
}

function OrderDialog({
    id,
    onClose,
    onChanged,
    onNotice,
}: {
    id: number;
    onClose: () => void;
    onChanged: () => void;
    onNotice: (n: Notice) => void;
}) {
    const { state, reload, refresh } = useApiData<{ order?: OrderRow }>(`/api/admin/shop/orders/${id}`, undefined, 'GET');
    const order = state.status === 'ok' ? state.data.order : undefined;
    return (
        <Modal open size="lg" title={order ? `주문 ${order.orderNo}` : '주문'} onClose={onClose}>
            {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {order && (
                <OrderDetail
                    key={`${order.id}-${order.status}`}
                    order={order}
                    onChanged={() => {
                        refresh();
                        onChanged();
                    }}
                    onStale={() => {
                        // 취소 완료 또는 그사이 상태가 바뀜 → 목록 새로고침 후 닫기
                        onChanged();
                        onClose();
                    }}
                    onNotice={onNotice}
                />
            )}
        </Modal>
    );
}

function OrderDetail({
    order,
    onChanged,
    onStale,
    onNotice,
}: {
    order: OrderRow;
    onChanged: () => void;
    onStale: () => void;
    onNotice: (n: Notice) => void;
}) {
    const [memo, setMemo] = useState(order.adminMemo ?? '');
    const [reason, setReason] = useState('');
    const [cancelling, setCancelling] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<Notice>(null);

    // 조치 공통: 실패 시 문구, 'Order changed'면 목록 새로고침 후 닫기
    const run = async (fn: () => Promise<unknown>, okText: string, after?: () => void) => {
        setBusy(true);
        setNotice(null);
        try {
            await fn();
            setNotice({ tone: 'ok', text: okText });
            after?.();
        } catch (e) {
            const text = shopErrorMessage(e);
            setNotice({ tone: 'error', text });
            if (text.startsWith('그사이')) {
                onNotice({ tone: 'error', text });
                onStale();
            }
        } finally {
            setBusy(false);
        }
    };

    const doCancel = () => {
        const text = reason.trim();
        if (!text || text.length > 200) return setNotice({ tone: 'error', text: '취소 사유를 1~200자로 입력해 주세요.' });
        if (!window.confirm(cancelConfirmText(order.payMethod))) return;
        run(async () => {
            const r = await cancelOrder(order.id, text);
            onNotice({ tone: 'ok', text: r.refundManually ? '취소했어요. 계좌로 직접 환불해 주세요.' : '취소했어요.' });
            onStale();
        }, '취소했어요.');
    };

    // KCP 결제(카드·계좌이체)는 결제 완료 후에만, 무통장은 입금 대기에서도 취소 가능
    const paid = order.status === 'paid' || order.status === 'completed';
    const canCancel = order.payMethod === 'deposit' ? paid || order.status === 'awaiting_deposit' : paid;

    const rows: [string, React.ReactNode][] = [
        ['상품', order.productTitle],
        ['금액', formatWon(order.amount)],
        ['수단', PAY_METHOD_LABEL[order.payMethod] ?? order.payMethod],
        ['상태', ORDER_STATUS_LABEL[order.status]],
        ['주문일', new Date(order.createdAt).toLocaleString('ko-KR')],
        ['주문자', order.buyerName],
        ['연락처', order.buyerPhone],
        ['이메일', order.buyerEmail],
        ['KCP 거래번호', order.kcpTno],
        ['가상계좌', order.vbankAccount ? `${order.vbankBank ?? ''} ${order.vbankAccount} (${order.vbankHolder ?? ''})` : null],
        ['입금자명', order.depositName],
        ['요청사항', order.buyerMemo],
    ];

    return (
        <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 rounded-lg bg-surface p-3 text-sm">
                {rows.map(([k, v]) => (
                    <div key={k} className="contents">
                        <dt className="text-muted">{k}</dt>
                        <dd className="whitespace-pre-wrap break-words">{v || '-'}</dd>
                    </div>
                ))}
            </dl>
            {order.history && (
                <div>
                    <p className="mb-1 text-sm font-medium">변경 기록</p>
                    <p className="whitespace-pre-wrap break-words rounded-lg border border-line p-3 text-xs text-muted">{order.history}</p>
                </div>
            )}
            <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-sm font-medium">
                    관리자 메모 (고객에게 보이지 않음)
                    <textarea rows={3} maxLength={1000} value={memo} onChange={e => setMemo(e.target.value)} className={`${FIELD} font-normal`} />
                </label>
                <Button variant="secondary" className="self-end" disabled={busy} onClick={() => run(() => saveOrderMemo(order.id, memo), '메모를 저장했어요.')}>
                    메모 저장
                </Button>
            </div>
            <NoticeLine notice={notice} />
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                {order.status === 'awaiting_deposit' && (
                    <Button disabled={busy} onClick={() => run(() => orderAction(order.id, 'confirm-deposit'), '입금을 확인했어요.', onChanged)}>
                        입금 확인
                    </Button>
                )}
                {order.status === 'paid' && (
                    <Button disabled={busy} onClick={() => run(() => orderAction(order.id, 'complete'), '완료 처리했어요.', onChanged)}>
                        완료 처리
                    </Button>
                )}
                {canCancel && (
                    <Button variant="ghost" className="text-rejected-fg" disabled={busy} onClick={() => setCancelling(v => !v)}>
                        취소
                    </Button>
                )}
            </div>
            {cancelling && canCancel && (
                <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
                    <label className="flex flex-col gap-1 text-sm font-medium">
                        취소 사유 (필수, 200자까지)
                        <input maxLength={200} value={reason} onChange={e => setReason(e.target.value)} className={`${FIELD} font-normal`} />
                    </label>
                    <Button variant="ghost" className="self-end text-rejected-fg" disabled={busy} onClick={doCancel}>
                        주문 취소하기
                    </Button>
                </div>
            )}
        </div>
    );
}
