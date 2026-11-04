'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { apiFetch, ApiError } from '@/lib/api';
import { formatMoneyInput, parseMoney, vat } from '@/lib/contract';
import { accountGroups, nextTax, SIDE_LABEL, type Account, type LedgerDetail, type Side } from '@/lib/ledger';
import { kstDate } from '@/lib/schedule';
import { formatWon } from '@/lib/shop';

const MAX_AMOUNT = 2_000_000_000;
const CONFLICT_TEXT = '다른 사람이 먼저 고쳤어요. 내 입력은 그대로 두었어요 — 새로 불러온 뒤 다시 저장해 주세요.';
const FIELD_CLASS = 'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary-soft';

type Form = { side: Side; entryDate: string; accountId: string; title: string; supply: string; tax: string; taxEdited: boolean; memo: string };
type Errors = Partial<Record<'entryDate' | 'accountId' | 'title' | 'supply' | 'tax', string>>;

// 새 장부: 날짜 기본값은 KST 오늘 (브라우저 로컬 날짜 쓰지 않음)
const newForm = (side: Side): Form => ({ side, entryDate: kstDate(Date.now()), accountId: '', title: '', supply: '', tax: '', taxEdited: false, memo: '' });
const toForm = (d: LedgerDetail): Form => ({
    side: d.side,
    entryDate: d.entryDate,
    accountId: String(d.accountId),
    title: d.title,
    supply: formatMoneyInput(String(d.supply)),
    tax: formatMoneyInput(String(d.tax)),
    taxEdited: d.tax !== vat(d.supply), // 예전에 직접 넣은 부가세는 공급가를 고쳐도 덮어쓰지 않음
    memo: d.memo,
});
const sameForm = (a: Form, b: Form) => (Object.keys(a) as (keyof Form)[]).every(k => a[k] === b[k]);

function validate(f: Form): Errors {
    const e: Errors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.entryDate)) e.entryDate = '날짜를 골라 주세요';
    if (!f.accountId) e.accountId = '계정과목을 골라 주세요';
    if (!f.title.trim()) e.title = '제목을 입력해 주세요';
    else if (f.title.trim().length > 200) e.title = '제목은 200자까지예요';
    const supply = parseMoney(f.supply);
    const tax = parseMoney(f.tax);
    if (Math.abs(supply) > MAX_AMOUNT) e.supply = '금액은 ±20억 원까지예요';
    if (Math.abs(tax) > MAX_AMOUNT) e.tax = '금액은 ±20억 원까지예요';
    if (!e.supply && !e.tax && Math.abs(supply + tax) > MAX_AMOUNT) e.supply = '합계는 ±20억 원까지예요';
    return e;
}

function errorText(e: unknown) {
    if (e instanceof ApiError) {
        if (e.status === 404) return '장부를 찾을 수 없어요. 이미 삭제됐을 수 있어요.';
        if (e.status === 403) return '권한이 없어요.';
        if (e.status === 400 && e.reason === 'Invalid accountId') return '고를 수 없는 계정과목이에요. 다시 골라 주세요.';
    }
    return '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
}

// 장부 팝업 — target이 'new'면 새 장부, 숫자면 보기·수정·삭제
export function LedgerDialog({
    target,
    accounts,
    defaultSide,
    onClose,
    onChanged,
}: {
    target: 'new' | number;
    accounts: Account[];
    defaultSide: Side;
    onClose: () => void;
    onChanged: () => void;
}) {
    const isNew = target === 'new';
    const [loadError, setLoadError] = useState(false);
    const [loaded, setLoaded] = useState(isNew);
    const [initial, setInitial] = useState<Form>(() => newForm(defaultSide));
    const [form, setForm] = useState<Form>(initial);
    const [updatedAt, setUpdatedAt] = useState(''); // 열었을 때(또는 새로 불러온) 수정 시각 — 저장 때 되돌려 보냄
    const [errors, setErrors] = useState<Errors>({});
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [conflict, setConflict] = useState(false);

    const fetchDetail = useCallback(async () => (await apiFetch<{ entry: LedgerDetail }>(`/api/work/ledger/${target}`)).entry, [target]);

    useEffect(() => {
        if (target === 'new') return;
        // 화면을 떠난 뒤 도착한 응답은 무시
        let active = true;
        fetchDetail()
            .then(d => {
                if (!active) return;
                const f = toForm(d);
                setInitial(f);
                setForm(f);
                setUpdatedAt(d.updatedAt);
                setLoaded(true);
            })
            .catch(() => active && setLoadError(true));
        return () => {
            active = false;
        };
    }, [target, fetchDetail]);

    const dirty = !sameForm(form, initial);
    // 저장 중에는 닫지 않고, 변경이 있으면 확인
    const canClose = () => !busy && (!dirty || window.confirm('작성 중인 내용이 사라져요. 닫을까요?'));

    const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(prev => ({ ...prev, [key]: value }));

    // 구분이 바뀌면 그 구분 항목만 고를 수 있으므로 계정 초기화
    const changeSide = (side: Side) => setForm(prev => ({ ...prev, side, accountId: '' }));

    // 공급가를 바꾸면 부가세 자동 계산 (사용자가 부가세를 직접 고친 뒤에는 유지)
    const changeSupply = (raw: string) =>
        setForm(prev => {
            const supply = formatMoneyInput(raw);
            const tax = nextTax({ supply: parseMoney(prev.supply), tax: parseMoney(prev.tax), taxEdited: prev.taxEdited }, parseMoney(supply));
            return { ...prev, supply, tax: formatMoneyInput(String(tax)) };
        });

    const autoTax = () => setForm(prev => ({ ...prev, taxEdited: false, tax: formatMoneyInput(String(vat(parseMoney(prev.supply)))) }));

    const save = async () => {
        const found = validate(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        setBusy(true);
        setMessage('');
        setConflict(false);
        try {
            await apiFetch(isNew ? '/api/work/ledger' : `/api/work/ledger/${target}`, {
                method: 'POST',
                body: {
                    side: form.side,
                    entryDate: form.entryDate,
                    accountId: Number(form.accountId),
                    title: form.title.trim(),
                    memo: form.memo,
                    supply: parseMoney(form.supply),
                    tax: parseMoney(form.tax),
                    ...(isNew ? {} : { updatedAt }),
                },
            });
            onChanged();
            onClose();
        } catch (e) {
            if (e instanceof ApiError && e.status === 409 && e.reason === 'Ledger changed') setConflict(true);
            else setMessage(errorText(e));
            setBusy(false);
        }
    };

    // 충돌 뒤: 최신 수정 시각만 받고 입력은 유지 (실패해도 입력 그대로)
    const reloadAfterConflict = async () => {
        setBusy(true);
        try {
            const d = await fetchDetail();
            setUpdatedAt(d.updatedAt);
            setConflict(false);
            setMessage('최신 내용을 확인했어요. 지금 저장하면 내 입력으로 바뀌어요.');
        } catch (e) {
            setMessage(e instanceof ApiError && e.status === 404 ? errorText(e) : '새로 불러오지 못했어요. 입력은 그대로예요. 잠시 뒤 다시 시도해 주세요.');
        }
        setBusy(false);
    };

    const remove = async () => {
        if (!window.confirm('이 장부를 삭제할까요? 되돌릴 수 없어요.')) return;
        setBusy(true);
        try {
            await apiFetch(`/api/work/ledger/${target}`, { method: 'DELETE' });
            onChanged();
            onClose();
        } catch (e) {
            setMessage(errorText(e));
            setBusy(false);
        }
    };

    const groups = accountGroups(accounts, form.side);
    const total = parseMoney(form.supply) + parseMoney(form.tax);

    return (
        <Modal open title={isNew ? '새 장부' : '장부 수정'} size="lg" onClose={onClose} canClose={canClose}>
            {(message || conflict) && (
                <div role="alert" className="mb-3 rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected-fg">
                    {conflict ? (
                        <span className="flex flex-wrap items-center gap-3">
                            {CONFLICT_TEXT}
                            <Button variant="secondary" disabled={busy} onClick={reloadAfterConflict}>
                                새로 불러오기
                            </Button>
                        </span>
                    ) : (
                        message
                    )}
                </div>
            )}

            {loadError ? (
                <ErrorState onRetry={() => window.location.reload()} />
            ) : !loaded ? (
                <Skeleton className="h-64 w-full" />
            ) : (
                <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1 text-sm font-medium">
                        구분
                        <select className={FIELD_CLASS} value={form.side} onChange={e => changeSide(e.target.value as Side)}>
                            {(Object.keys(SIDE_LABEL) as Side[]).map(s => (
                                <option key={s} value={s}>
                                    {SIDE_LABEL[s]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <TextField label="날짜" name="entryDate" type="date" value={form.entryDate} error={errors.entryDate} onChange={e => set('entryDate', e.target.value)} />
                    <label className="flex flex-col gap-1 text-sm font-medium">
                        계정과목
                        <select
                            aria-invalid={errors.accountId ? true : undefined}
                            className={`${FIELD_CLASS} ${errors.accountId ? 'border-rejected-fg' : ''}`}
                            value={form.accountId}
                            onChange={e => set('accountId', e.target.value)}
                        >
                            <option value="">선택해 주세요</option>
                            {groups.map(g =>
                                g.group ? (
                                    <optgroup key={g.group.id} label={g.group.name}>
                                        {g.items.map(i => (
                                            <option key={i.id} value={i.id}>
                                                {i.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ) : (
                                    g.items.map(i => (
                                        <option key={i.id} value={i.id}>
                                            {i.name}
                                        </option>
                                    ))
                                ),
                            )}
                        </select>
                        {errors.accountId && <span className="text-xs font-normal text-rejected-fg">{errors.accountId}</span>}
                    </label>
                    <TextField label="제목" name="title" maxLength={200} value={form.title} error={errors.title} onChange={e => set('title', e.target.value)} />
                    <TextField
                        label="공급가 (원)"
                        name="supply"
                        inputMode="numeric"
                        value={form.supply}
                        error={errors.supply}
                        hint="환불 등은 앞에 -를 붙여요"
                        onChange={e => changeSupply(e.target.value)}
                    />
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <TextField
                                label="부가세 (원)"
                                name="tax"
                                inputMode="numeric"
                                value={form.tax}
                                error={errors.tax}
                                onChange={e => setForm(prev => ({ ...prev, tax: formatMoneyInput(e.target.value), taxEdited: true }))}
                            />
                        </div>
                        <Button variant="secondary" disabled={!form.taxEdited} onClick={autoTax}>
                            자동 계산
                        </Button>
                    </div>
                    <p className="text-sm">
                        합계 <strong className={`tabular-nums ${total < 0 ? 'text-rejected-fg' : ''}`}>{formatWon(total)}</strong>
                    </p>
                    <label className="flex flex-col gap-1 text-sm font-medium">
                        메모
                        <textarea rows={4} maxLength={5000} className={FIELD_CLASS} value={form.memo} onChange={e => set('memo', e.target.value)} />
                    </label>
                    <div className="flex justify-end gap-2">
                        {!isNew && (
                            <Button variant="ghost" className="text-rejected-fg" disabled={busy} onClick={remove}>
                                삭제
                            </Button>
                        )}
                        <Button variant="secondary" disabled={busy} onClick={() => canClose() && onClose()}>
                            취소
                        </Button>
                        <Button disabled={busy} onClick={save}>
                            {busy ? '저장 중…' : '저장'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
