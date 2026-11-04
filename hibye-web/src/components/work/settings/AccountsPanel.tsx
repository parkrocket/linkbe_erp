'use client';

import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { NoticeLine } from '@/components/admin/homepage/HomepageTab';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch, ApiError } from '@/lib/api';
import { accountGroups, codeStartsWith, SIDE_LABEL, type Account, type Side } from '@/lib/ledger';
import type { Notice } from './settingsApi';

const ACCOUNTS_API = '/api/work/accounts';
const IN_USE = '장부나 하위 계정과목이 있는 계정은 지울 수 없어요';
const CODE_HELP = '영문·숫자 10자까지 — 다른 코드의 앞부분이 되면 묶음(장부에서 고를 수 없음)이 돼요';
const INPUT = 'rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-soft';

type Form = { side: Side; code: string; label: string; name: string };
const EMPTY: Form = { side: 'sales', code: '', label: '', name: '' };

// 서버 오류 사유 → 사용자 문구
function accountError(e: unknown): string {
    if (e instanceof ApiError) {
        if (e.reason === 'Duplicate code') return '같은 구분에 이미 있는 코드예요';
        if (e.reason === 'Invalid code') return '장부가 연결된 계정은 묶음이 되는 코드로 바꿀 수 없어요';
        if (e.reason === 'In use') return IN_USE;
        if (e.status === 404) return '찾을 수 없어요. 이미 삭제됐을 수 있어요.';
        if (e.status === 403) return '업무 문서 권한이 없어요.';
    }
    return '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
}

// 계정과목 — 구분별 목록(묶음은 굵게, 항목은 들여쓰기). 장부·하위가 있으면 삭제 불가
export function AccountsPanel() {
    const { state, reload, refresh } = useApiData<{ accounts: Account[] }>(ACCOUNTS_API, undefined, 'GET');
    const [notice, setNotice] = useState<Notice>(null);
    const [form, setForm] = useState<Form>(EMPTY);
    const [editId, setEditId] = useState<number | null>(null);
    const [edit, setEdit] = useState<Form>(EMPTY);
    const [busy, setBusy] = useState(false);

    // 공통 실행기 — 중복 클릭 방지, 오류는 안내 줄에
    const act = async (fn: () => Promise<unknown>, okText: string) => {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
            setNotice({ tone: 'ok', text: okText });
            refresh();
        } catch (e) {
            setNotice({ tone: 'error', text: accountError(e) });
        } finally {
            setBusy(false);
        }
    };

    // 입력 검사 — 서버 규칙과 같게(코드 형식은 서버도 거절)
    const check = (f: Form) => {
        if (!/^[A-Za-z0-9]{1,10}$/.test(f.code.trim())) return '코드는 영문·숫자 10자까지 입력해 주세요.';
        if (!f.name.trim()) return '이름을 입력해 주세요.';
        return null;
    };
    const body = (f: Form) => ({ side: f.side, code: f.code.trim(), label: f.label.trim(), name: f.name.trim() });

    const add = () => {
        const err = check(form);
        if (err) return setNotice({ tone: 'error', text: err });
        act(async () => {
            await apiFetch(ACCOUNTS_API, { method: 'POST', body: body(form) });
            setForm({ ...EMPTY, side: form.side });
        }, '계정과목을 추가했어요.');
    };

    const save = (id: number) => {
        const err = check(edit);
        if (err) return setNotice({ tone: 'error', text: err });
        act(async () => {
            await apiFetch(`${ACCOUNTS_API}/${id}`, { method: 'POST', body: body(edit) });
            setEditId(null);
        }, '계정과목을 고쳤어요.');
    };

    const remove = (a: Account) => {
        if (!window.confirm(`'${a.name}' 계정과목을 삭제할까요?`)) return;
        act(() => apiFetch(`${ACCOUNTS_API}/${a.id}`, { method: 'DELETE' }), '계정과목을 삭제했어요.');
    };

    if (state.status === 'loading') return <Skeleton className="h-64 w-full" />;
    if (state.status === 'error') return <ErrorState onRetry={reload} />;
    const accounts = state.data.accounts;

    // 하위 여부 — 같은 구분에서 코드 앞부분이 같은 다른 계정이 있는지
    const hasChild = (a: Account) => accounts.some(o => o.id !== a.id && o.side === a.side && codeStartsWith(o.code, a.code));

    const row = (a: Account, indent: boolean) => {
        if (editId === a.id) {
            return (
                <li key={a.id} className="py-2">
                    <FormFields value={edit} onChange={setEdit} idPrefix={`edit-${a.id}`} sideLocked={a.used > 0} />
                    <div className="mt-2 flex gap-2">
                        <Button disabled={busy} onClick={() => save(a.id)}>
                            저장
                        </Button>
                        <Button variant="ghost" onClick={() => setEditId(null)}>
                            취소
                        </Button>
                    </div>
                </li>
            );
        }
        const locked = a.used > 0 || hasChild(a);
        return (
            <li key={a.id} className={`flex flex-wrap items-center gap-2 py-2 ${indent ? 'pl-6' : ''}`}>
                <span className="w-24 shrink-0 font-mono text-xs text-muted">{a.code}</span>
                <span className="w-20 shrink-0 text-xs text-muted">{a.label}</span>
                <span className={`min-w-0 flex-1 truncate text-sm ${a.isGroup ? 'font-bold' : ''}`}>{a.name}</span>
                <span className="text-xs text-muted">{a.isGroup ? '묶음' : `장부 ${a.used}건`}</span>
                <Button
                    variant="secondary"
                    className="px-3 py-1.5"
                    onClick={() => {
                        setEditId(a.id);
                        setEdit({ side: a.side, code: a.code, label: a.label, name: a.name });
                    }}
                >
                    고치기
                </Button>
                <Button variant="secondary" className="px-3 py-1.5" disabled={busy || locked} title={locked ? IN_USE : undefined} onClick={() => remove(a)}>
                    삭제
                </Button>
                {locked && <span className="w-full text-xs text-muted">{IN_USE}</span>}
            </li>
        );
    };

    return (
        <>
            <NoticeLine notice={notice} />
            <form
                className="mb-6"
                onSubmit={e => {
                    e.preventDefault();
                    add();
                }}
            >
                <FormFields value={form} onChange={setForm} idPrefix="new" />
                <Button type="submit" className="mt-2" disabled={busy}>
                    추가
                </Button>
            </form>
            {(['sales', 'purchase'] as Side[]).map(side => {
                const groups = accountGroups(accounts, side);
                const count = accounts.filter(a => a.side === side).length;
                return (
                    <section key={side} className="mb-6">
                        <h2 className="mb-1 text-base font-bold">{SIDE_LABEL[side]}</h2>
                        {!count ? (
                            <EmptyState message="계정과목이 없어요" />
                        ) : (
                            <ul className="divide-y divide-line">
                                {groups.flatMap(g => [...(g.group ? [row(g.group, false)] : []), ...g.items.map(i => row(i, !!g.group))])}
                            </ul>
                        )}
                    </section>
                );
            })}
        </>
    );
}

// 구분·코드·번호·이름 입력 줄 (추가·고치기 공용)
function FormFields({ value, onChange, idPrefix, sideLocked = false }: { value: Form; onChange: (f: Form) => void; idPrefix: string; sideLocked?: boolean }) {
    const set = (patch: Partial<Form>) => onChange({ ...value, ...patch });
    const helpId = `${idPrefix}-code-help`;
    return (
        <div className="flex flex-wrap gap-2">
            <select aria-label="구분" value={value.side} onChange={e => set({ side: e.target.value as Side })} disabled={sideLocked} className={INPUT}>
                <option value="sales">{SIDE_LABEL.sales}</option>
                <option value="purchase">{SIDE_LABEL.purchase}</option>
            </select>
            <input aria-label="코드" aria-describedby={helpId} value={value.code} onChange={e => set({ code: e.target.value })} maxLength={10} placeholder="코드" className={`${INPUT} w-28`} />
            <input aria-label="번호" value={value.label} onChange={e => set({ label: e.target.value })} maxLength={50} placeholder="번호(선택)" className={`${INPUT} w-28`} />
            <input aria-label="이름" value={value.name} onChange={e => set({ name: e.target.value })} maxLength={100} placeholder="이름" className={`${INPUT} min-w-0 flex-1`} />
            <p id={helpId} className="w-full text-xs text-muted">
                {CODE_HELP}
            </p>
            {sideLocked && <p className="w-full text-xs text-muted">장부가 있는 계정은 구분을 바꿀 수 없어요</p>}
        </div>
    );
}
