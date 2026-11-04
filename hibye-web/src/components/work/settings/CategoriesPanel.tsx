'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NoticeLine } from '@/components/admin/homepage/HomepageTab';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Category } from '@/lib/contract';
import { CATEGORY_IN_USE, deleteSetting, postSetting, settingsError, type Notice } from './settingsApi';

// 분류 — 이름·순서(▲▼)·사용 중 계약 수. 쓰는 곳이 있으면 삭제 불가
export function CategoriesPanel({ categories, refresh }: { categories: Category[]; refresh: () => void }) {
    const [notice, setNotice] = useState<Notice>(null);
    const [newName, setNewName] = useState('');
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [busy, setBusy] = useState(false);

    // 공통 실행기 — 중복 클릭 방지, 오류는 안내 줄에
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

    const add = () => {
        const name = newName.trim();
        if (!name) return setNotice({ tone: 'error', text: '분류 이름을 입력해 주세요.' });
        act(async () => {
            await postSetting('/categories', { name });
            setNewName('');
        }, '분류를 추가했어요.');
    };

    const saveName = (id: number) => {
        const name = editName.trim();
        if (!name) return setNotice({ tone: 'error', text: '분류 이름을 입력해 주세요.' });
        act(async () => {
            await postSetting(`/categories/${id}`, { name });
            setEditId(null);
        }, '이름을 고쳤어요.');
    };

    const remove = (c: Category) => {
        if (!window.confirm(`'${c.name}' 분류를 삭제할까요?`)) return;
        act(() => deleteSetting(`/categories/${c.id}`), '분류를 삭제했어요.');
    };

    return (
        <>
            <NoticeLine notice={notice} />
            <form
                className="mb-4 flex gap-2"
                onSubmit={e => {
                    e.preventDefault();
                    add();
                }}
            >
                <input
                    aria-label="새 분류 이름"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    maxLength={50}
                    placeholder="새 분류 이름"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-primary-soft"
                />
                <Button type="submit" disabled={busy}>
                    추가
                </Button>
            </form>
            {!categories.length ? (
                <EmptyState message="분류가 없어요" />
            ) : (
                <ul className="divide-y divide-line">
                    {categories.map((c, i) => (
                        <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                            {editId === c.id ? (
                                <>
                                    <input
                                        aria-label="분류 이름"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        maxLength={50}
                                        autoFocus
                                        className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-soft"
                                    />
                                    <Button disabled={busy} onClick={() => saveName(c.id)}>
                                        저장
                                    </Button>
                                    <Button variant="ghost" onClick={() => setEditId(null)}>
                                        취소
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                                    <span className="text-xs text-muted">계약 {c.used}건</span>
                                    <MoveButton label="위로" disabled={busy || i === 0} onClick={() => act(() => postSetting(`/categories/${c.id}/move`, { dir: 'up' }))}>
                                        <ChevronUp className="size-4" />
                                    </MoveButton>
                                    <MoveButton label="아래로" disabled={busy || i === categories.length - 1} onClick={() => act(() => postSetting(`/categories/${c.id}/move`, { dir: 'down' }))}>
                                        <ChevronDown className="size-4" />
                                    </MoveButton>
                                    <Button variant="secondary" className="px-3 py-1.5" onClick={() => (setEditId(c.id), setEditName(c.name))}>
                                        이름 고치기
                                    </Button>
                                    {/* 계약 수만 알 수 있어 0이어도 품목 문구·양식이 쓰면 서버가 거절 → 같은 안내를 보여 줌 */}
                                    <Button
                                        variant="secondary"
                                        className="px-3 py-1.5"
                                        disabled={busy || c.used > 0}
                                        title={c.used > 0 ? CATEGORY_IN_USE : undefined}
                                        onClick={() => remove(c)}
                                    >
                                        삭제
                                    </Button>
                                    {c.used > 0 && <span className="w-full text-xs text-muted">{CATEGORY_IN_USE}</span>}
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

// 순서 이동 버튼 (품목 문구 화면도 사용)
export function MoveButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className="rounded p-1.5 text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30"
        >
            {children}
        </button>
    );
}
