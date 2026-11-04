'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { formatMoneyInput, itemAmount, itemsTotal, parseMoney, receivable, vat, type Category, type ContractDetail, type ContractManager, type ItemTemplate } from '@/lib/contract';
import { fromFormItem, toFormItem, type FormItem, ItemsEditor } from './ItemsEditor';

const MAX_AMOUNT = 2000000000;
const INPUT = 'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';

type FormManager = ContractManager & { key: number };
type FormState = {
    docNo: string;
    categoryId: string;
    companyName: string;
    bizNo: string;
    ceoName: string;
    companyEmail: string;
    projectName: string;
    contractDate: string;
    deliveryDate: string;
    workPeriod: string;
    memo: string;
    link1: string;
    link2: string;
    total: string;
    deposit: string;
    balance: string;
    paidAmount: string;
    isHold: boolean;
    isCancelled: boolean;
    isPaidFull: boolean;
    invoiceIssued: boolean;
    opsServer1: string;
    opsServer2: string;
    opsSpend: string;
    opsSite: string;
    items: FormItem[];
    managers: FormManager[];
};

let managerKey = 1;
const emptyManager = (): FormManager => ({ key: managerKey++, name: '', phone: '', email: '', memo: '' });

const toState = (c?: ContractDetail): FormState => ({
    docNo: c?.docNo ?? '',
    categoryId: c?.categoryId ? String(c.categoryId) : '',
    companyName: c?.companyName ?? '',
    bizNo: c?.bizNo ?? '',
    ceoName: c?.ceoName ?? '',
    companyEmail: c?.companyEmail ?? '',
    projectName: c?.projectName ?? '',
    contractDate: c?.contractDate ?? '',
    deliveryDate: c?.deliveryDate ?? '',
    workPeriod: c?.workPeriod ?? '',
    memo: c?.memo ?? '',
    link1: c?.link1 ?? '',
    link2: c?.link2 ?? '',
    total: formatMoneyInput(String(c?.total ?? 0)),
    deposit: formatMoneyInput(String(c?.deposit ?? 0)),
    balance: formatMoneyInput(String(c?.balance ?? 0)),
    paidAmount: formatMoneyInput(String(c?.paidAmount ?? 0)),
    isHold: c?.isHold ?? false,
    isCancelled: c?.isCancelled ?? false,
    isPaidFull: c?.isPaidFull ?? false,
    invoiceIssued: c?.invoiceIssued ?? false,
    opsServer1: c?.opsServer1 ?? '',
    opsServer2: c?.opsServer2 ?? '',
    opsSpend: c?.opsSpend ?? '',
    opsSite: c?.opsSite ?? '',
    items: (c?.items ?? []).map(toFormItem),
    managers: c?.managers.length ? c.managers.map(m => ({ ...m, key: managerKey++ })) : [emptyManager()],
});

// 입력 검사 — 서버가 다시 검사하므로 자주 틀리는 것만 먼저 안내. 문제 없으면 ''
function validate(f: FormState): string {
    if (!f.companyName.trim()) return '업체명을 입력해 주세요.';
    for (const [label, v] of [['합계', f.total], ['계약금', f.deposit], ['완료금', f.balance], ['입금액', f.paidAmount]] as const) {
        if (Math.abs(parseMoney(v)) > MAX_AMOUNT) return `${label}은 ±20억원 안으로 입력해 주세요.`;
    }
    const items = f.items.map(fromFormItem);
    const bad = items.findIndex(i => !i.content);
    if (bad >= 0) return `${bad + 1}번 품목의 내용을 입력해 주세요.`;
    if (items.some(i => i.qty > 100000 || i.period > 10000)) return '수량은 100,000, 기간은 10,000까지예요.';
    if (items.some(i => Math.abs(itemAmount(i)) > MAX_AMOUNT) || Math.abs(itemsTotal(items)) > MAX_AMOUNT) return '품목 금액은 ±20억원 안으로 입력해 주세요.';
    for (const link of [f.link1, f.link2]) if (link.trim() && !/^https?:\/\//i.test(link.trim())) return '링크는 http:// 또는 https://로 시작해 주세요.';
    return '';
}

function errorText(e: unknown) {
    if (e instanceof ApiError) {
        if (e.status === 404) return '계약을 찾을 수 없어요. 이미 삭제됐을 수 있어요.';
        if (e.status === 403) return '권한이 없어요.';
        if (e.reason === 'Invalid categoryId') return '분류를 다시 골라 주세요.';
        if (e.status === 400) return '입력한 내용을 다시 확인해 주세요.';
    }
    return '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
}

const CONFLICT_TEXT = '다른 사람이 먼저 고쳤어요. 내 입력은 그대로 두었어요 — 새로 불러온 뒤 다시 저장해 주세요.';

type Company = { companyName: string; bizNo: string; ceoName: string; companyEmail: string; managerName: string; managerPhone: string; managerEmail: string };

// 작성·수정 폼 — 새 계약(initial 없음)과 상세의 수정 모드 공용
export function ContractForm({ initial, onCancel, onSaved, onReload }: { initial?: ContractDetail; onCancel?: () => void; onSaved?: () => void | Promise<void>; onReload?: () => void | Promise<void> }) {
    const router = useRouter();
    const [form, setForm] = useState<FormState>(() => toState(initial));
    const [categories, setCategories] = useState<Category[]>([]);
    const [templates, setTemplates] = useState<ItemTemplate[]>([]);
    const [suggest, setSuggest] = useState<Company[]>([]);
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [busy, setBusy] = useState(false);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }));
    const text = (key: 'docNo' | 'bizNo' | 'ceoName' | 'companyEmail' | 'projectName' | 'workPeriod' | 'link1' | 'link2' | 'opsSite') => ({
        value: form[key],
        onChange: (e: { target: { value: string } }) => set(key, e.target.value),
    });
    const money = (key: 'total' | 'deposit' | 'balance' | 'paidAmount') => ({
        value: form[key],
        inputMode: 'numeric' as const,
        onChange: (e: { target: { value: string } }) => set(key, formatMoneyInput(e.target.value)),
    });

    // 분류 목록 (한 번)
    useEffect(() => {
        let active = true;
        apiFetch<{ categories: Category[] }>('/api/work/doc-settings')
            .then(r => active && setCategories(r.categories))
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    // 분류가 바뀌면 그 분류의 품목 문구 (늦게 온 이전 응답은 무시)
    useEffect(() => {
        let active = true;
        const id = Number(form.categoryId);
        (id ? apiFetch<{ itemTemplates: ItemTemplate[] }>(`/api/work/doc-settings/item-templates?categoryId=${id}`).then(r => r.itemTemplates) : Promise.resolve([]))
            .then(list => active && setTemplates(list))
            .catch(() => active && setTemplates([]));
        return () => {
            active = false;
        };
    }, [form.categoryId]);

    // 업체 자동 완성 — 2자 이상, 입력이 300ms 멈춘 뒤 요청, 늦게 온 응답은 최신 입력을 덮지 않음
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const seq = useRef(0);
    useEffect(() => () => clearTimeout(timer.current), []);
    const onCompanyInput = (value: string) => {
        set('companyName', value);
        clearTimeout(timer.current);
        const mine = ++seq.current;
        const q = value.trim();
        if (q.length < 2) return setSuggest([]);
        timer.current = setTimeout(async () => {
            try {
                const r = await apiFetch<{ companies: Company[] }>(`/api/work/contracts/companies?q=${encodeURIComponent(q)}`);
                if (mine === seq.current) setSuggest(r.companies);
            } catch {
                if (mine === seq.current) setSuggest([]);
            }
        }, 300);
    };
    // 고를 때만 업체 정보와 첫 담당자를 덮어씀
    const closeSuggest = () => {
        seq.current++; // 늦게 오는 응답이 다시 열지 않게
        clearTimeout(timer.current);
        setSuggest([]);
    };
    const pickCompany = (c: Company) => {
        closeSuggest();
        setForm(prev => {
            // 추천에 값이 없는 칸은 이미 입력한 담당자 정보를 유지
            const cur = prev.managers[0] ?? emptyManager();
            const first = { ...cur, name: c.managerName || cur.name, phone: c.managerPhone || cur.phone, email: c.managerEmail || cur.email };
            return { ...prev, companyName: c.companyName, bizNo: c.bizNo, ceoName: c.ceoName, companyEmail: c.companyEmail, managers: [first, ...prev.managers.slice(1)] };
        });
    };

    const patchManager = (key: number, p: Partial<ContractManager>) => set('managers', form.managers.map(m => (m.key === key ? { ...m, ...p } : m)));

    const save = async () => {
        const problem = validate(form);
        setError(problem);
        setConflict(false);
        if (problem) return;
        setBusy(true);
        const payload = {
            docNo: form.docNo.trim(),
            categoryId: form.categoryId ? Number(form.categoryId) : null,
            companyName: form.companyName.trim(),
            bizNo: form.bizNo.trim(),
            ceoName: form.ceoName.trim(),
            companyEmail: form.companyEmail.trim(),
            projectName: form.projectName.trim(),
            contractDate: form.contractDate || null,
            deliveryDate: form.deliveryDate || null,
            workPeriod: form.workPeriod.trim(),
            memo: form.memo,
            link1: form.link1.trim(),
            link2: form.link2.trim(),
            total: parseMoney(form.total),
            deposit: parseMoney(form.deposit),
            balance: parseMoney(form.balance),
            paidAmount: parseMoney(form.paidAmount),
            isHold: form.isHold,
            isCancelled: form.isCancelled,
            isPaidFull: form.isPaidFull,
            invoiceIssued: form.invoiceIssued,
            opsServer1: form.opsServer1,
            opsServer2: form.opsServer2,
            opsSpend: form.opsSpend,
            opsSite: form.opsSite.trim(),
            items: form.items.map(fromFormItem),
            managers: form.managers.map(({ name, phone, email, memo }) => ({ name: name.trim(), phone: phone.trim(), email: email.trim(), memo: memo.trim() })),
            // 수정일 때만 — 열었을 때의 수정 시각(다른 사람이 먼저 고쳤는지 서버가 비교)
            ...(initial ? { updatedAt: initial.updatedAt } : {}),
        };
        try {
            if (initial) {
                await apiFetch(`/api/work/contracts/${initial.id}`, { method: 'POST', body: payload });
                await onSaved?.();
            } else {
                const r = await apiFetch<{ id: number }>('/api/work/contracts', { method: 'POST', body: payload });
                router.push(`/work/contracts/${r.id}`);
            }
        } catch (e) {
            if (e instanceof ApiError && e.status === 409 && e.reason === 'Contract changed') setConflict(true);
            else setError(errorText(e));
            setBusy(false);
        }
    };

    const totalNum = parseMoney(form.total);
    const debt = receivable({ total: totalNum, paidAmount: parseMoney(form.paidAmount), isHold: form.isHold, isCancelled: form.isCancelled });

    return (
        <form
            className="flex flex-col gap-6"
            onSubmit={e => {
                e.preventDefault();
                void save();
            }}
        >
            {(error || conflict) && (
                <div role="alert" className="rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected-fg">
                    {conflict ? (
                        <span className="flex flex-wrap items-center gap-3">
                            {CONFLICT_TEXT}
                            {onReload && (
                                <Button variant="secondary" onClick={onReload}>
                                    새로 불러오기
                                </Button>
                            )}
                        </span>
                    ) : (
                        error
                    )}
                </div>
            )}

            <Section title="기본 정보">
                <Field label="문서번호" hint="비워 두면 저장할 때 자동으로 정해져요">
                    <input maxLength={30} className={INPUT} {...text('docNo')} />
                </Field>
                <Field label="분류">
                    <select className={INPUT} value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                        <option value="">분류 없음</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <div
                    className="relative"
                    onBlur={e => !e.currentTarget.contains(e.relatedTarget) && closeSuggest()}
                >
                    <Field label="업체명 (필수)">
                        <input
                            required
                            maxLength={100}
                            autoComplete="off"
                            className={INPUT}
                            value={form.companyName}
                            onChange={e => onCompanyInput(e.target.value)}
                            onKeyDown={e => e.key === 'Escape' && closeSuggest()}
                        />
                    </Field>
                    {suggest.length > 0 && (
                        <ul onMouseDown={e => e.preventDefault()} className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-white text-sm shadow-lg" aria-label="업체 추천">
                            {suggest.map((c, i) => (
                                <li key={`${c.companyName}-${i}`}>
                                    <button type="button" className="flex w-full gap-2 px-3 py-2 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary" onClick={() => pickCompany(c)}>
                                        <span className="font-semibold">{c.companyName}</span>
                                        <span className="text-muted">{c.ceoName}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <Field label="사업자번호">
                    <input maxLength={30} className={INPUT} {...text('bizNo')} />
                </Field>
                <Field label="대표자">
                    <input maxLength={50} className={INPUT} {...text('ceoName')} />
                </Field>
                <Field label="업체 이메일">
                    <input type="email" maxLength={150} className={INPUT} {...text('companyEmail')} />
                </Field>
                <Field label="프로젝트명" wide>
                    <input maxLength={200} className={INPUT} {...text('projectName')} />
                </Field>
                <Field label="계약일">
                    <input type="date" className={INPUT} value={form.contractDate} onChange={e => set('contractDate', e.target.value)} />
                </Field>
                <Field label="납품일">
                    <input type="date" className={INPUT} value={form.deliveryDate} onChange={e => set('deliveryDate', e.target.value)} />
                </Field>
                <Field label="작업기간">
                    <input maxLength={100} className={INPUT} {...text('workPeriod')} />
                </Field>
            </Section>

            <Section title="담당자" single>
                {form.managers.map((m, i) => (
                    <div key={m.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1.5fr_1.5fr_auto]">
                        <input aria-label={`담당자 ${i + 1} 이름`} placeholder="이름" maxLength={50} className={INPUT} value={m.name} onChange={e => patchManager(m.key, { name: e.target.value })} />
                        <input aria-label={`담당자 ${i + 1} 전화`} placeholder="전화" maxLength={50} className={INPUT} value={m.phone} onChange={e => patchManager(m.key, { phone: e.target.value })} />
                        <input aria-label={`담당자 ${i + 1} 이메일`} placeholder="이메일" maxLength={150} className={INPUT} value={m.email} onChange={e => patchManager(m.key, { email: e.target.value })} />
                        <input aria-label={`담당자 ${i + 1} 메모`} placeholder="메모" maxLength={255} className={INPUT} value={m.memo} onChange={e => patchManager(m.key, { memo: e.target.value })} />
                        <Button variant="ghost" aria-label={`담당자 ${i + 1} 삭제`} onClick={() => set('managers', form.managers.filter(x => x.key !== m.key))}>
                            삭제
                        </Button>
                    </div>
                ))}
                <div>
                    <Button variant="secondary" disabled={form.managers.length >= 20} onClick={() => set('managers', [...form.managers, emptyManager()])}>
                        담당자 추가
                    </Button>
                </div>
            </Section>

            <Section title="품목" single>
                <ItemsEditor items={form.items} templates={templates} onChange={items => set('items', items)} onApplyTotal={n => set('total', formatMoneyInput(String(n)))} />
            </Section>

            <Section title="금액 (부가세 제외, 원)">
                <Field label="합계">
                    <input className={`${INPUT} text-right`} {...money('total')} />
                </Field>
                <Field label="계약금">
                    <input className={`${INPUT} text-right`} {...money('deposit')} />
                </Field>
                <Field label="완료금">
                    <input className={`${INPUT} text-right`} {...money('balance')} />
                </Field>
                <Field label="입금액">
                    <input className={`${INPUT} text-right`} {...money('paidAmount')} />
                </Field>
                <p className="col-span-full rounded-lg bg-surface px-3 py-2.5 text-sm" aria-live="polite">
                    부가세 <strong className="tabular-nums">{vat(totalNum).toLocaleString('ko-KR')}원</strong> · 총액{' '}
                    <strong className="tabular-nums">{(totalNum + vat(totalNum)).toLocaleString('ko-KR')}원</strong> · 미수{' '}
                    <strong className="tabular-nums">{debt.toLocaleString('ko-KR')}원</strong>
                </p>
                <fieldset className="col-span-full flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <legend className="sr-only">상태</legend>
                    {([['isHold', '보류'], ['isCancelled', '취소'], ['isPaidFull', '완납'], ['invoiceIssued', '계산서 발행']] as const).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5">
                            <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} />
                            {label}
                        </label>
                    ))}
                </fieldset>
            </Section>

            <Section title="운영·기타">
                <Field label="운영서버 1" wide>
                    <textarea rows={3} maxLength={10000} className={INPUT} value={form.opsServer1} onChange={e => set('opsServer1', e.target.value)} />
                </Field>
                <Field label="운영서버 2" wide>
                    <textarea rows={3} maxLength={10000} className={INPUT} value={form.opsServer2} onChange={e => set('opsServer2', e.target.value)} />
                </Field>
                <Field label="운영비용" wide>
                    <textarea rows={3} maxLength={10000} className={INPUT} value={form.opsSpend} onChange={e => set('opsSpend', e.target.value)} />
                </Field>
                <Field label="운영 사이트">
                    <input maxLength={500} className={INPUT} {...text('opsSite')} />
                </Field>
                <Field label="링크 1">
                    <input maxLength={500} placeholder="https://" className={INPUT} {...text('link1')} />
                </Field>
                <Field label="링크 2">
                    <input maxLength={500} placeholder="https://" className={INPUT} {...text('link2')} />
                </Field>
                <Field label="메모" wide>
                    <textarea rows={4} maxLength={10000} className={INPUT} value={form.memo} onChange={e => set('memo', e.target.value)} />
                </Field>
            </Section>

            <div className="flex justify-end gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => (onCancel ? onCancel() : router.push('/work/contracts'))}>
                    취소
                </Button>
                <Button type="submit" disabled={busy}>
                    {busy ? '저장 중…' : '저장'}
                </Button>
            </div>
        </form>
    );
}

function Section({ title, single, children }: { title: string; single?: boolean; children: React.ReactNode }) {
    return (
        <fieldset className="rounded-lg border border-line p-4">
            <legend className="px-2 text-sm font-bold">{title}</legend>
            <div className={single ? 'flex flex-col gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-3'}>{children}</div>
        </fieldset>
    );
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
    return (
        <label className={`flex flex-col gap-1 text-sm font-medium ${wide ? 'sm:col-span-3' : ''}`}>
            {label}
            {children}
            {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
        </label>
    );
}
