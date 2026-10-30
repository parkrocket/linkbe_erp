'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { adminErrorMessage } from '@/lib/authMessages';
import { orgMembers } from '@/lib/org';
import {
    createOrgItem,
    deleteOrgItem,
    moveOrgItem,
    renameOrgItem,
    STATUS_LABEL,
    type AdminUser,
    type OrgItem,
    type OrgKind,
    type OrgLists,
} from './adminApi';
import { MemberDialog } from './MemberDialog';

const KIND_LABEL: Record<OrgKind, string> = { departments: '부서', positions: '직급' };
type Act = (action: () => Promise<unknown>, doneText: string) => Promise<boolean>;
type View = (kind: OrgKind, item: OrgItem) => void;

// 조직 탭 — 회사별 부서·직급 목록 관리 (추가·이름 변경·순서·삭제)
export function OrgTab() {
    const { state, reload, refresh } = useApiData<Partial<OrgLists>>('/api/admin/org', undefined, 'GET');
    // 소속 명단용 직원 목록 (부서·직급 번호 포함)
    const members = useApiData<{ users?: AdminUser[] }>('/api/admin/users', undefined, 'GET');
    const [viewing, setViewing] = useState<{ kind: OrgKind; item: OrgItem } | null>(null);
    const [opened, setOpened] = useState<number | null>(null);
    const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

    if (state.status === 'loading') return <Skeleton className="h-48 w-full" />;
    if (state.status === 'error') return <ErrorState onRetry={reload} />;

    // 공통 처리: 실행 → 안내 → 목록 갱신. 성공 여부 반환(입력칸 비우기용)
    const act: Act = async (action, doneText) => {
        setNotice(null);
        try {
            await action();
            setNotice({ tone: 'ok', text: doneText });
            reload();
            return true;
        } catch (error) {
            setNotice({ tone: 'error', text: adminErrorMessage(error) });
            return false;
        }
    };

    return (
        <>
            {notice && (
                <p
                    role={notice.tone === 'error' ? 'alert' : 'status'}
                    className={`mb-3 rounded-lg px-3 py-2.5 text-sm ${notice.tone === 'error' ? 'bg-rejected-bg text-rejected-fg' : 'bg-approved-bg text-approved-fg'}`}
                >
                    {notice.text}
                </p>
            )}
            <div className="grid gap-6 md:grid-cols-2">
                {(['departments', 'positions'] as const).map(kind => (
                    <OrgList
                        key={kind}
                        kind={kind}
                        items={state.data[kind] ?? []}
                        act={act}
                        onView={(k, item) => setViewing({ kind: k, item })}
                    />
                ))}
            </div>

            {viewing && (
                <OrgMembersDialog
                    kind={viewing.kind}
                    item={viewing.item}
                    state={members.state}
                    names={{ departments: state.data.departments ?? [], positions: state.data.positions ?? [] }}
                    onRetry={members.reload}
                    onClose={() => setViewing(null)}
                    onOpen={mbNo => {
                        setViewing(null);
                        setOpened(mbNo);
                    }}
                />
            )}
            {opened !== null && (
                <MemberDialog
                    mbNo={opened}
                    onClose={() => setOpened(null)}
                    // 부서·직급을 바꾸면 소속 인원·명단도 갱신 (화면 유지)
                    onChanged={() => {
                        refresh();
                        members.refresh();
                    }}
                />
            )}
        </>
    );
}

const OTHER: Record<OrgKind, { key: 'dept_id' | 'position_id'; kind: OrgKind }> = {
    departments: { key: 'position_id', kind: 'positions' },
    positions: { key: 'dept_id', kind: 'departments' },
};

// 부서·직급 소속 명단 — 부서면 직급을, 직급이면 부서를 함께 표시. 누르면 직원 상세 팝업
function OrgMembersDialog({
    kind,
    item,
    state,
    names,
    onRetry,
    onClose,
    onOpen,
}: {
    kind: OrgKind;
    item: OrgItem;
    state: ReturnType<typeof useApiData<{ users?: AdminUser[] }>>['state'];
    names: OrgLists;
    onRetry: () => void;
    onClose: () => void;
    onOpen: (mbNo: number) => void;
}) {
    const other = OTHER[kind];
    const nameOf = (id: number | null) => names[other.kind].find(o => o.id === id)?.name;
    const list = state.status === 'ok' ? orgMembers(state.data.users ?? [], kind, item.id) : [];

    return (
        <Modal open title={`${item.name} 소속 (${KIND_LABEL[kind]})`} onClose={onClose}>
            {state.status === 'loading' && <Skeleton className="h-32 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={onRetry} />}
            {state.status === 'ok' &&
                (!list.length ? (
                    <EmptyState message="소속 직원이 없어요" />
                ) : (
                    <ul className="divide-y divide-line">
                        {list.map(u => (
                            <li key={u.mb_no}>
                                <button
                                    type="button"
                                    onClick={() => onOpen(u.mb_no)}
                                    className="flex w-full items-center gap-2 rounded-lg px-1 py-2.5 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    <span className="font-bold">{u.user_name}</span>
                                    {nameOf(u[other.key]) && <span className="text-muted">· {nameOf(u[other.key])}</span>}
                                    {u.user_status !== 'approved' && <Badge tone="neutral">{STATUS_LABEL[u.user_status]}</Badge>}
                                </button>
                            </li>
                        ))}
                    </ul>
                ))}
        </Modal>
    );
}

function OrgList({ kind, items, act, onView }: { kind: OrgKind; items: OrgItem[]; act: Act; onView: View }) {
    const label = KIND_LABEL[kind];
    const [name, setName] = useState('');

    const add = async (event: FormEvent) => {
        event.preventDefault();
        if (!name.trim()) return;
        if (await act(() => createOrgItem(kind, name.trim()), `${label} '${name.trim()}'을(를) 추가했어요.`)) setName('');
    };

    return (
        <section aria-label={`${label} 목록`}>
            <h2 className="mb-2 text-sm font-bold">{label}</h2>
            {!items.length ? (
                <EmptyState message={`아직 ${label}이(가) 없어요`} />
            ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                    {items.map((item, i) => (
                        <OrgRow
                            key={item.id}
                            kind={kind}
                            item={item}
                            first={i === 0}
                            last={i === items.length - 1}
                            act={act}
                            onView={onView}
                        />
                    ))}
                </ul>
            )}
            <form onSubmit={add} className="mt-2 flex gap-2">
                <input
                    aria-label={`새 ${label} 이름`}
                    placeholder={`새 ${label} 이름`}
                    maxLength={50}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft"
                />
                <Button type="submit" variant="secondary" disabled={!name.trim()}>
                    추가
                </Button>
            </form>
        </section>
    );
}

function OrgRow({
    kind,
    item,
    first,
    last,
    act,
    onView,
}: {
    kind: OrgKind;
    item: OrgItem;
    first: boolean;
    last: boolean;
    act: Act;
    onView: View;
}) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(item.name);

    const rename = async (event: FormEvent) => {
        event.preventDefault();
        if (!name.trim() || name.trim() === item.name) return setEditing(false);
        if (await act(() => renameOrgItem(kind, item.id, name.trim()), `이름을 '${name.trim()}'(으)로 바꿨어요.`)) setEditing(false);
    };

    if (editing) {
        return (
            <li className="p-2">
                <form onSubmit={rename} className="flex gap-2">
                    <input
                        aria-label="새 이름"
                        autoFocus
                        maxLength={50}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-primary bg-white px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-primary-soft"
                    />
                    <Button type="submit">저장</Button>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setName(item.name);
                            setEditing(false);
                        }}
                    >
                        취소
                    </Button>
                </form>
            </li>
        );
    }

    return (
        <li className="flex items-center gap-2 px-3 py-2">
            {/* 이름을 누르면 소속 명단 팝업 */}
            <button
                type="button"
                onClick={() => onView(kind, item)}
                aria-label={`${item.name} 소속 직원 보기`}
                className="-m-1 min-w-0 flex-1 truncate rounded-md p-1 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
            >
                {item.name}
                <span className="ml-1.5 text-xs text-muted">{item.member_count}명</span>
            </button>
            <IconButton
                label={`${item.name} 위로`}
                disabled={first}
                onClick={() => act(() => moveOrgItem(kind, item.id, 'up'), '순서를 바꿨어요.')}
            >
                <ChevronUp className="size-4" />
            </IconButton>
            <IconButton
                label={`${item.name} 아래로`}
                disabled={last}
                onClick={() => act(() => moveOrgItem(kind, item.id, 'down'), '순서를 바꿨어요.')}
            >
                <ChevronDown className="size-4" />
            </IconButton>
            <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(true)}>
                이름 변경
            </Button>
            {/* 소속 직원이 있으면 삭제 불가 (서버도 409) — 버튼 대신 이유 */}
            {item.member_count > 0 ? (
                <span className="text-xs text-muted">사용 중</span>
            ) : (
                <Button
                    variant="ghost"
                    className="px-2 py-1 text-rejected-fg"
                    onClick={() => act(() => deleteOrgItem(kind, item.id), `'${item.name}'을(를) 삭제했어요.`)}
                >
                    삭제
                </Button>
            )}
        </li>
    );
}

function IconButton({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30"
        >
            {children}
        </button>
    );
}
