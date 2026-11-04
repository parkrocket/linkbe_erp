'use client';

import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatMoneyInput, itemAmount, itemsTotal, parseMoney, type ContractItem, type ItemTemplate } from '@/lib/contract';

// 화면용 품목 행 — 숫자 칸은 입력 중 문자열(콤마·음수 표시), key는 끌어 옮길 때 행을 구분
export type FormItem = {
    key: number;
    groupName: string;
    content: string;
    unitPrice: string;
    qty: string;
    period: string;
    note: string;
    discount: boolean;
};

let nextKey = 1;
export const newItemKey = () => nextKey++;

export const emptyItem = (): FormItem => ({ key: newItemKey(), groupName: '', content: '', unitPrice: '', qty: '1', period: '1', note: '', discount: false });

export const toFormItem = (i: Pick<ContractItem, 'groupName' | 'content' | 'unitPrice' | 'qty' | 'period' | 'note' | 'kind'>): FormItem => ({
    key: newItemKey(),
    groupName: i.groupName,
    content: i.content,
    unitPrice: formatMoneyInput(String(i.unitPrice)),
    qty: String(i.qty),
    period: String(i.period),
    note: i.note,
    discount: i.kind === 'discount',
});

// 화면 행 → 계산·전송용 품목
export const fromFormItem = (f: FormItem): ContractItem => ({
    groupName: f.groupName.trim(),
    content: f.content.trim(),
    unitPrice: parseMoney(f.unitPrice),
    qty: Number(f.qty.replace(/\D/g, '')) || 0,
    period: Number(f.period.replace(/\D/g, '')) || 0,
    note: f.note.trim(),
    kind: f.discount ? 'discount' : 'normal',
});

const INPUT = 'w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';
const ICON_BTN =
    'rounded-md p-1.5 text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40';

// 품목 표 편집 — 끌어서 순서 변경(마우스) + 위/아래 버튼(키보드), 행 금액·품목 합계 표시
export function ItemsEditor({
    items,
    templates,
    onChange,
    onApplyTotal,
}: {
    items: FormItem[];
    templates: ItemTemplate[];
    onChange: (items: FormItem[]) => void;
    onApplyTotal: (total: number) => void;
}) {
    const [dragKey, setDragKey] = useState<number | null>(null);
    const [showTemplates, setShowTemplates] = useState(false);
    const rowRefs = useRef(new Map<number, HTMLLIElement>());

    const patch = (key: number, p: Partial<FormItem>) => onChange(items.map(i => (i.key === key ? { ...i, ...p } : i)));
    const move = (from: number, to: number) => {
        if (to < 0 || to >= items.length || from === to) return;
        const next = [...items];
        next.splice(to, 0, next.splice(from, 1)[0]);
        onChange(next);
    };
    const parsed = items.map(fromFormItem);
    const sum = itemsTotal(parsed);

    return (
        <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">품목</span>
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={!templates.length} onClick={() => setShowTemplates(v => !v)} aria-expanded={showTemplates}>
                        품목 문구 불러오기
                    </Button>
                    <Button variant="secondary" onClick={() => onChange([...items, emptyItem()])}>
                        품목 추가
                    </Button>
                </div>
            </div>
            {!templates.length && <p className="mb-2 text-xs text-muted">분류를 고르면 그 분류의 품목 문구를 불러올 수 있어요.</p>}

            {showTemplates && (
                <ul className="mb-3 max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
                    {templates.map(t => (
                        <li key={t.id}>
                            <button
                                type="button"
                                className="flex w-full gap-2 px-3 py-2 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                                onClick={() => onChange([...items, toFormItem(t)])}
                            >
                                <span className="w-24 shrink-0 text-muted">{t.groupName}</span>
                                <span className="min-w-0 flex-1 truncate">{t.content}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {items.length === 0 ? (
                <p className="rounded-lg bg-surface px-3 py-4 text-center text-sm text-muted">품목이 없어요. 품목을 추가해 주세요.</p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {items.map((it, idx) => (
                        <li
                            key={it.key}
                            ref={el => {
                                if (el) rowRefs.current.set(it.key, el);
                                else rowRefs.current.delete(it.key);
                            }}
                            onDragOver={e => dragKey !== null && e.preventDefault()}
                            onDrop={e => {
                                e.preventDefault();
                                const from = items.findIndex(x => x.key === dragKey);
                                if (from >= 0) move(from, idx);
                                setDragKey(null);
                            }}
                            className={`rounded-lg border bg-white p-2.5 ${dragKey === it.key ? 'border-primary opacity-60' : 'border-line'}`}
                        >
                            <div className="flex items-start gap-2">
                                <span
                                    draggable
                                    aria-hidden
                                    title="끌어서 순서 바꾸기"
                                    className="mt-1.5 cursor-grab text-muted"
                                    onDragStart={e => {
                                        setDragKey(it.key);
                                        e.dataTransfer.effectAllowed = 'move';
                                        const row = rowRefs.current.get(it.key);
                                        if (row) e.dataTransfer.setDragImage(row, 0, 0);
                                    }}
                                    onDragEnd={() => setDragKey(null)}
                                >
                                    <GripVertical className="size-4" />
                                </span>
                                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-6">
                                    <input aria-label={`${idx + 1}번 구분`} placeholder="구분" maxLength={100} className={`${INPUT} sm:col-span-1`} value={it.groupName} onChange={e => patch(it.key, { groupName: e.target.value })} />
                                    <input aria-label={`${idx + 1}번 내용`} placeholder="내용 (필수)" maxLength={255} className={`${INPUT} col-span-2 sm:col-span-3`} value={it.content} onChange={e => patch(it.key, { content: e.target.value })} />
                                    <input aria-label={`${idx + 1}번 비고`} placeholder="비고" maxLength={255} className={`${INPUT} col-span-2 sm:col-span-2`} value={it.note} onChange={e => patch(it.key, { note: e.target.value })} />
                                    <input aria-label={`${idx + 1}번 단가`} placeholder="단가" inputMode="numeric" className={`${INPUT} text-right`} value={it.unitPrice} onChange={e => patch(it.key, { unitPrice: formatMoneyInput(e.target.value) })} />
                                    <input aria-label={`${idx + 1}번 수량`} placeholder="수량" inputMode="numeric" className={`${INPUT} text-right`} value={it.qty} onChange={e => patch(it.key, { qty: e.target.value.replace(/\D/g, '') })} />
                                    <input aria-label={`${idx + 1}번 기간`} placeholder="기간" inputMode="numeric" className={`${INPUT} text-right`} value={it.period} onChange={e => patch(it.key, { period: e.target.value.replace(/\D/g, '') })} />
                                    <label className="flex items-center gap-1.5 text-xs text-muted">
                                        <input type="checkbox" checked={it.discount} onChange={e => patch(it.key, { discount: e.target.checked })} />
                                        할인
                                    </label>
                                    <span className="col-span-2 self-center text-right text-sm font-semibold tabular-nums sm:col-span-2" aria-label={`${idx + 1}번 금액`}>
                                        {itemAmount(parsed[idx]).toLocaleString('ko-KR')}원
                                    </span>
                                </div>
                                <div className="flex shrink-0 flex-col sm:flex-row">
                                    <button type="button" aria-label={`${idx + 1}번 위로`} className={ICON_BTN} disabled={idx === 0} onClick={() => move(idx, idx - 1)}>
                                        <ArrowUp className="size-4" />
                                    </button>
                                    <button type="button" aria-label={`${idx + 1}번 아래로`} className={ICON_BTN} disabled={idx === items.length - 1} onClick={() => move(idx, idx + 1)}>
                                        <ArrowDown className="size-4" />
                                    </button>
                                    <button type="button" aria-label={`${idx + 1}번 삭제`} className={`${ICON_BTN} hover:text-rejected-fg`} onClick={() => onChange(items.filter(x => x.key !== it.key))}>
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2.5 text-sm">
                <span>
                    품목 합계 <strong className="tabular-nums">{sum.toLocaleString('ko-KR')}원</strong>
                    <span className="ml-2 text-xs text-muted">할인 품목은 단가를 -로 입력해요</span>
                </span>
                <Button variant="secondary" onClick={() => onApplyTotal(sum)}>
                    합계에 품목 합계 넣기
                </Button>
            </div>
        </div>
    );
}
