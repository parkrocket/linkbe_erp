'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { NoticeLine } from '@/components/admin/homepage/HomepageTab';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { formatMoneyInput, parseMoney, type Category, type ItemTemplate } from '@/lib/contract';
import { MoveButton } from './CategoriesPanel';
import { deleteSetting, postSetting, settingsError, SETTINGS_API, type Notice } from './settingsApi';

// 품목 문구 — 분류를 고르면 그 분류의 자주 쓰는 품목 목록 (계약 작성 때 불러다 씀)
export function ItemTemplatesPanel({ categories }: { categories: Category[] }) {
    const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null);

    if (!categories.length) return <EmptyState message="먼저 '분류' 탭에서 분류를 추가해 주세요" />;
    // 지워진 분류가 선택돼 있으면 첫 분류로
    const current = categories.some(c => c.id === categoryId) ? categoryId : categories[0].id;

    return (
        <>
            <label className="mb-4 flex items-center gap-2 text-sm font-medium">
                분류
                <select
                    value={current ?? ''}
                    onChange={e => setCategoryId(Number(e.target.value))}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
            </label>
            {/* key로 분류가 바뀌면 목록 상태를 새로 */}
            {current != null && <ItemList key={current} categoryId={current} />}
        </>
    );
}

type Draft = {
    groupName: string;
    content: string;
    unitPrice: string;
    qty: string;
    period: string;
    note: string;
    discount: boolean;
};

const EMPTY_DRAFT: Draft = { groupName: '', content: '', unitPrice: '', qty: '', period: '', note: '', discount: false };

const toDraft = (t: ItemTemplate): Draft => ({
    groupName: t.groupName,
    content: t.content,
    unitPrice: t.unitPrice ? t.unitPrice.toLocaleString('ko-KR') : '',
    qty: t.qty ? String(t.qty) : '',
    period: t.period ? String(t.period) : '',
    note: t.note,
    discount: t.kind === 'discount',
});

function ItemList({ categoryId }: { categoryId: number }) {
    const { state, reload, refresh } = useApiData<{ itemTemplates: ItemTemplate[] }>(
        `${SETTINGS_API}/item-templates?categoryId=${categoryId}`,
        undefined,
        'GET',
    );
    const [editing, setEditing] = useState<ItemTemplate | 'new' | null>(null);
    const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
    const [notice, setNotice] = useState<Notice>(null);
    const [formError, setFormError] = useState('');
    const [busy, setBusy] = useState(false);
    const items = state.status === 'ok' ? state.data.itemTemplates : [];

    const open = (t: ItemTemplate | 'new') => {
        setDraft(t === 'new' ? EMPTY_DRAFT : toDraft(t));
        setFormError('');
        setEditing(t);
    };
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));

    const save = async () => {
        if (busy || !editing) return;
        const content = draft.content.trim();
        const qty = Number(draft.qty || 0);
        const period = Number(draft.period || 0);
        if (!content) return setFormError('내용을 입력해 주세요.');
        if (!Number.isInteger(qty) || qty < 0 || qty > 100000) return setFormError('수량은 0~100,000 사이 정수예요.');
        if (!Number.isInteger(period) || period < 0 || period > 10000) return setFormError('기간은 0~10,000 사이 정수예요.');
        const unitPrice = parseMoney(draft.unitPrice);
        if (Math.abs(unitPrice) > 2_000_000_000) return setFormError('단가는 ±20억 안에서 입력해 주세요.');
        setBusy(true);
        try {
            await postSetting(editing === 'new' ? '/item-templates' : `/item-templates/${editing.id}`, {
                categoryId,
                groupName: draft.groupName.trim(),
                content,
                unitPrice,
                qty,
                period,
                note: draft.note.trim(),
                kind: draft.discount ? 'discount' : 'normal',
            });
            setEditing(null);
            setNotice({ tone: 'ok', text: '저장했어요.' });
            refresh();
        } catch (e) {
            setFormError(settingsError(e));
        } finally {
            setBusy(false);
        }
    };

    // 삭제·이동 공통 실행기
    const act = async (fn: () => Promise<unknown>, okText?: string) => {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
            setNotice(okText ? { tone: 'ok', text: okText } : null);
            refresh();
        } catch (e) {
            setNotice({ tone: 'error', text: settingsError(e) });
        } finally {
            setBusy(false);
        }
    };

    const remove = (t: ItemTemplate) => {
        if (!window.confirm(`'${t.content.slice(0, 30)}' 문구를 삭제할까요?`)) return;
        act(() => deleteSetting(`/item-templates/${t.id}`), '삭제했어요.');
    };

    return (
        <>
            <NoticeLine notice={notice} />
            <div className="mb-3 flex justify-end">
                <Button onClick={() => open('new')}>품목 문구 추가</Button>
            </div>
            {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (!items.length ? (
                    <EmptyState message="이 분류에 품목 문구가 없어요" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead>
                                <tr className="border-b border-line text-left text-xs text-muted">
                                    <th className="py-2 pr-2 font-medium">구분</th>
                                    <th className="py-2 pr-2 font-medium">내용</th>
                                    <th className="py-2 pr-2 text-right font-medium">단가</th>
                                    <th className="py-2 pr-2 text-right font-medium">수량</th>
                                    <th className="py-2 pr-2 text-right font-medium">기간</th>
                                    <th className="py-2 pr-2 font-medium">비고</th>
                                    <th className="py-2 font-medium">
                                        <span className="sr-only">관리</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {items.map((t, i) => (
                                    <tr key={t.id}>
                                        <td className="py-2 pr-2 align-top">{t.groupName}</td>
                                        <td className="max-w-64 py-2 pr-2 align-top">
                                            <button
                                                type="button"
                                                onClick={() => open(t)}
                                                className="line-clamp-2 rounded text-left font-medium hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                                            >
                                                {t.content}
                                            </button>
                                            {t.kind === 'discount' && <Badge tone="neutral">할인</Badge>}
                                        </td>
                                        <td className="py-2 pr-2 text-right align-top">{t.unitPrice.toLocaleString('ko-KR')}</td>
                                        <td className="py-2 pr-2 text-right align-top">{t.qty || '-'}</td>
                                        <td className="py-2 pr-2 text-right align-top">{t.period || '-'}</td>
                                        <td className="max-w-40 truncate py-2 pr-2 align-top text-muted">{t.note}</td>
                                        <td className="py-2 text-right align-top whitespace-nowrap">
                                            <MoveButton label="위로" disabled={busy || i === 0} onClick={() => act(() => postSetting(`/item-templates/${t.id}/move`, { dir: 'up' }))}>
                                                <ChevronUp className="size-4" />
                                            </MoveButton>
                                            <MoveButton label="아래로" disabled={busy || i === items.length - 1} onClick={() => act(() => postSetting(`/item-templates/${t.id}/move`, { dir: 'down' }))}>
                                                <ChevronDown className="size-4" />
                                            </MoveButton>
                                            <Button variant="ghost" className="px-2 py-1" disabled={busy} onClick={() => remove(t)}>
                                                삭제
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            <Modal open={editing !== null} title={editing === 'new' ? '품목 문구 추가' : '품목 문구 수정'} onClose={() => setEditing(null)}>
                <form
                    className="flex flex-col gap-3"
                    onSubmit={e => {
                        e.preventDefault();
                        save();
                    }}
                >
                    <TextField label="구분" value={draft.groupName} maxLength={100} onChange={e => set('groupName', e.target.value)} hint="같은 구분이 이어지면 표에서 칸이 합쳐져요. '유지보수'·'할인'은 표에서 합계 줄이 따로 붙어요" />
                    <label className="flex flex-col gap-1 text-sm font-medium">
                        내용
                        <textarea
                            value={draft.content}
                            maxLength={255}
                            rows={3}
                            onChange={e => set('content', e.target.value)}
                            className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-normal focus-visible:outline-2 focus-visible:outline-primary-soft"
                        />
                    </label>
                    <TextField label="단가" inputMode="numeric" value={draft.unitPrice} onChange={e => set('unitPrice', formatMoneyInput(e.target.value))} hint="할인은 앞에 -를 붙여요" />
                    <div className="grid grid-cols-2 gap-3">
                        <TextField label="수량" inputMode="numeric" value={draft.qty} onChange={e => set('qty', e.target.value.replace(/\D/g, '').slice(0, 6))} />
                        <TextField label="기간" inputMode="numeric" value={draft.period} onChange={e => set('period', e.target.value.replace(/\D/g, '').slice(0, 5))} />
                    </div>
                    <TextField label="비고" value={draft.note} maxLength={255} onChange={e => set('note', e.target.value)} />
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={draft.discount} onChange={e => set('discount', e.target.checked)} className="size-4" />
                        할인 품목
                    </label>
                    {formError && (
                        <p role="alert" className="text-sm text-rejected-fg">
                            {formError}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setEditing(null)}>
                            취소
                        </Button>
                        <Button type="submit" disabled={busy}>
                            저장
                        </Button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
