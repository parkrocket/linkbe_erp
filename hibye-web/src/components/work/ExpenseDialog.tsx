'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { apiFetch, ApiError } from '@/lib/api';
import { kstDate } from '@/lib/schedule';
import { digitsOnly, formatWon } from '@/lib/shop';
import {
    EXPENSE_BODY_TEMPLATE,
    EXPENSE_CATEGORY_LABEL,
    EXPENSE_STATUS_LABEL,
    toExpensePayload,
    validateExpenseForm,
    type ExpenseCategory,
    type ExpenseDetail,
    type ExpenseForm,
    type ExpenseStatus,
} from '@/lib/work';
import { StatusBadge } from './StatusBadge';

const comma = (digits: string) => (digits ? Number(digits).toLocaleString('ko-KR') : '');
const newForm = (): ExpenseForm => ({ spentOn: kstDate(Date.now()), category: '', amount: '', title: '', body: EXPENSE_BODY_TEMPLATE });
const toForm = (d: ExpenseDetail): ExpenseForm => ({ spentOn: d.spentOn, category: d.category, amount: comma(String(d.amount)), title: d.title, body: d.body });
const sameForm = (a: ExpenseForm, b: ExpenseForm) => (Object.keys(a) as (keyof ExpenseForm)[]).every(k => a[k] === b[k]);

const FIELD_CLASS = 'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary-soft';

function errorText(e: unknown) {
    if (e instanceof ApiError) {
        if (e.status === 409 && e.reason === 'Not pending') return '이미 처리가 시작돼 고칠 수 없어요.';
        if (e.status === 409 && e.reason === 'Status changed') return '다른 사람이 먼저 상태를 바꿨어요. 다시 불러올게요.';
        if (e.status === 404) return '경비를 찾을 수 없어요. 이미 삭제됐을 수 있어요.';
        if (e.status === 403) return '권한이 없어요.';
    }
    return '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
}

// 경비 팝업 — target이 'new'면 기안, 숫자면 상세(보기·수정·상태 변경)
export function ExpenseDialog({
    target,
    canApprove,
    onClose,
    onChanged,
}: {
    target: 'new' | number;
    canApprove: boolean;
    onClose: () => void;
    onChanged: () => void;
}) {
    const isNew = target === 'new';
    const [detail, setDetail] = useState<ExpenseDetail | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [editing, setEditing] = useState(isNew);
    const [initial, setInitial] = useState<ExpenseForm>(newForm);
    const [form, setForm] = useState<ExpenseForm>(initial);
    const [errors, setErrors] = useState<ReturnType<typeof validateExpenseForm>>({});
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    const load = useCallback(async () => {
        if (target === 'new') return;
        try {
            const res = await apiFetch<{ expense: ExpenseDetail }>(`/api/work/expenses/${target}`);
            setDetail(res.expense);
            setLoadError(false);
        } catch {
            setLoadError(true);
        }
    }, [target]);

    useEffect(() => {
        // 마운트 때 상세 불러오기 (상태 갱신은 응답 뒤)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load();
    }, [load]);

    const dirty = editing && !sameForm(form, initial);
    // 저장 중에는 닫지 않고, 작성·수정 중 변경이 있으면 확인
    const canClose = () => !busy && (!dirty || window.confirm('작성 중인 내용이 사라져요. 닫을까요?'));

    const startEdit = () => {
        if (!detail) return;
        const f = toForm(detail);
        setInitial(f);
        setForm(f);
        setErrors({});
        setMessage('');
        setEditing(true);
    };

    const save = async () => {
        const found = validateExpenseForm(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        setBusy(true);
        setMessage('');
        try {
            await apiFetch(isNew ? '/api/work/expenses' : `/api/work/expenses/${target}`, { method: 'POST', body: toExpensePayload(form) });
            onChanged();
            if (isNew) return onClose();
            setEditing(false);
            await load();
        } catch (e) {
            setMessage(errorText(e));
            // 이미 처리가 시작됐다면 화면 상태도 맞춤
            if (e instanceof ApiError && e.status === 409) {
                setEditing(false);
                onChanged();
                await load();
            }
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!window.confirm('이 경비를 삭제할까요? 되돌릴 수 없어요.')) return;
        setBusy(true);
        try {
            await apiFetch(`/api/work/expenses/${target}`, { method: 'DELETE' });
            onChanged();
            onClose();
        } catch (e) {
            setMessage(errorText(e));
            if (e instanceof ApiError && e.status === 409) {
                onChanged();
                await load();
            }
            setBusy(false);
        }
    };

    const changeStatus = async (to: ExpenseStatus) => {
        if (!detail) return;
        setBusy(true);
        setMessage('');
        try {
            await apiFetch(`/api/work/expenses/${detail.id}/status`, { method: 'POST', body: { from: detail.status, to } });
        } catch (e) {
            setMessage(errorText(e));
        }
        // 성공이든 충돌이든 최신 상태로 맞춤
        onChanged();
        await load();
        setBusy(false);
    };

    const set = <K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) => setForm(prev => ({ ...prev, [key]: value }));
    const title = isNew ? '경비 기안' : editing ? '경비 수정' : '경비';
    const editable = detail?.isMine && detail.status === 'pending';

    return (
        <Modal open title={title} size="lg" onClose={onClose} canClose={canClose}>
            {message && (
                <p role="alert" className="mb-3 rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected-fg">
                    {message}
                </p>
            )}

            {editing ? (
                <div className="flex flex-col gap-4">
                    <TextField label="날짜" name="spentOn" type="date" value={form.spentOn} error={errors.spentOn} onChange={e => set('spentOn', e.target.value)} />
                    <label className="flex flex-col gap-1 text-sm font-medium">
                        분류
                        <select
                            aria-invalid={errors.category ? true : undefined}
                            className={`${FIELD_CLASS} ${errors.category ? 'border-rejected-fg' : 'border-line'}`}
                            value={form.category}
                            onChange={e => set('category', e.target.value as ExpenseCategory | '')}
                        >
                            <option value="">선택해 주세요</option>
                            {(Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[]).map(c => (
                                <option key={c} value={c}>
                                    {EXPENSE_CATEGORY_LABEL[c]}
                                </option>
                            ))}
                        </select>
                        {errors.category && <span className="text-xs font-normal text-rejected-fg">{errors.category}</span>}
                    </label>
                    <TextField
                        label="금액 (원)"
                        name="amount"
                        inputMode="numeric"
                        value={form.amount}
                        error={errors.amount}
                        onChange={e => set('amount', comma(digitsOnly(e.target.value)))}
                    />
                    <TextField label="제목" name="title" maxLength={100} value={form.title} error={errors.title} onChange={e => set('title', e.target.value)} />
                    <label className="flex flex-col gap-1 text-sm font-medium">
                        내용
                        <textarea
                            rows={8}
                            maxLength={5000}
                            className={`${FIELD_CLASS} ${errors.body ? 'border-rejected-fg' : 'border-line'}`}
                            value={form.body}
                            onChange={e => set('body', e.target.value)}
                        />
                        {errors.body && <span className="text-xs font-normal text-rejected-fg">{errors.body}</span>}
                    </label>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" disabled={busy} onClick={() => canClose() && (isNew ? onClose() : setEditing(false))}>
                            취소
                        </Button>
                        <Button disabled={busy} onClick={save}>
                            {busy ? '저장 중…' : '저장'}
                        </Button>
                    </div>
                </div>
            ) : loadError ? (
                <ErrorState onRetry={load} />
            ) : !detail ? (
                <Skeleton className="h-64 w-full" />
            ) : (
                <div className="flex flex-col gap-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={detail.status} />
                        <span className="text-muted">
                            {detail.spentOn} · {EXPENSE_CATEGORY_LABEL[detail.category]} · {detail.writerName}
                        </span>
                    </div>
                    <div>
                        <p className="text-base font-bold">{detail.title}</p>
                        <p className="mt-1 text-lg font-bold tabular-nums">{formatWon(detail.amount)}</p>
                    </div>
                    <pre className="whitespace-pre-wrap break-words rounded-lg bg-surface px-3 py-2.5 font-sans">{detail.body || '(내용 없음)'}</pre>
                    {detail.history && (
                        <div>
                            <p className="mb-1 text-xs font-semibold text-muted">이력</p>
                            <ul className="space-y-0.5 text-xs text-muted">
                                {detail.history
                                    .split('\n')
                                    .filter(Boolean)
                                    .map((line, i) => (
                                        <li key={i}>{line}</li>
                                    ))}
                            </ul>
                        </div>
                    )}
                    {canApprove && (
                        <div role="group" aria-label="상태 변경">
                            <p className="mb-1 text-xs font-semibold text-muted">상태 변경</p>
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(EXPENSE_STATUS_LABEL) as ExpenseStatus[]).map(s => (
                                    <Button
                                        key={s}
                                        variant={s === detail.status ? 'primary' : 'secondary'}
                                        aria-pressed={s === detail.status}
                                        disabled={busy || s === detail.status}
                                        onClick={() => changeStatus(s)}
                                    >
                                        {EXPENSE_STATUS_LABEL[s]}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        {editable && (
                            <>
                                <Button variant="ghost" className="text-rejected-fg" disabled={busy} onClick={remove}>
                                    삭제
                                </Button>
                                <Button variant="secondary" disabled={busy} onClick={startEdit}>
                                    수정
                                </Button>
                            </>
                        )}
                        <Button variant="secondary" onClick={() => canClose() && onClose()}>
                            닫기
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
