'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { apiFetch } from '@/lib/api';
import { clientErrorText, CLIENT_KIND_LABEL, validateClientName, type ClientKind, type ClientRow } from '@/lib/clients';

const SELECT_CLASS =
    'rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';

// 업체 목록 — 이름·구분 검색, 새 업체
export function ClientList() {
    const router = useRouter();
    const [q, setQ] = useState('');
    const [kind, setKind] = useState('');
    const [applied, setApplied] = useState({ q: '', kind: '' });
    const [creating, setCreating] = useState(false);

    const params = new URLSearchParams();
    if (applied.q.trim()) params.set('q', applied.q.trim());
    if (applied.kind) params.set('kind', applied.kind);
    const list = useApiData<{ clients: ClientRow[] }>(`/api/work/clients?${params}`, undefined, 'GET');
    const clients = list.state.status === 'ok' ? list.state.data.clients : null;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setApplied({ q, kind });
    };

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">거래처 접속정보</h1>
                <Button onClick={() => setCreating(true)}>새 업체</Button>
            </div>
            <p className="mb-4 text-xs text-muted">비밀번호·메모를 보거나 복사하면 누가 언제 봤는지 기록이 남아요.</p>

            <form onSubmit={submit} className="flex flex-wrap items-center gap-2" role="search" aria-label="업체 검색">
                <input type="search" aria-label="검색어 (업체·항목 이름·주소·아이디·메모·첨부)" placeholder="업체·아이디·주소·메모 검색" maxLength={100} className={`${SELECT_CLASS} w-64`} value={q} onChange={e => setQ(e.target.value)} />
                <select aria-label="구분" className={SELECT_CLASS} value={kind} onChange={e => setKind(e.target.value)}>
                    <option value="">전체 구분</option>
                    {(Object.keys(CLIENT_KIND_LABEL) as ClientKind[]).map(k => (
                        <option key={k} value={k}>
                            {CLIENT_KIND_LABEL[k]}
                        </option>
                    ))}
                </select>
                <Button type="submit" variant="secondary">
                    조회
                </Button>
            </form>

            {list.state.status === 'loading' && <Skeleton className="mt-4 h-72 w-full" />}
            {list.state.status === 'error' && (
                <div className="mt-4">
                    <ErrorState onRetry={list.reload} />
                </div>
            )}
            {clients &&
                (clients.length ? (
                    <div className="mt-4 overflow-x-auto rounded-lg border border-line">
                        <table className="w-full min-w-[36rem] text-left text-sm">
                            <caption className="sr-only">업체 목록</caption>
                            <thead className="bg-surface text-xs text-muted">
                                <tr>
                                    {['업체', '구분', '항목', '첨부', '예전 메모'].map(h => (
                                        <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {clients.map(c => (
                                    <tr key={c.id} className="hover:bg-surface">
                                        <td className="px-3 py-2.5">
                                            <Link href={`/work/clients/${c.id}`} className="font-semibold text-primary hover:underline">
                                                {c.name}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2.5 text-muted">{CLIENT_KIND_LABEL[c.kind]}</td>
                                        <td className="px-3 py-2.5 tabular-nums">{c.credentialCount}</td>
                                        <td className="px-3 py-2.5 tabular-nums">{c.fileCount}</td>
                                        <td className="px-3 py-2.5 text-muted">{c.hasLegacyMemo ? '있음' : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState message="업체가 없어요." />
                ))}

            {creating && <ClientFormDialog onClose={() => setCreating(false)} onSaved={id => router.push(`/work/clients/${id}`)} />}
        </main>
    );
}

// 업체 추가·이름 고치기 — client가 있으면 고치기
export function ClientFormDialog({
    client,
    onClose,
    onSaved,
}: {
    client?: { id: number; name: string; kind: ClientKind };
    onClose: () => void;
    onSaved: (id: number) => void;
}) {
    const [name, setName] = useState(client?.name ?? '');
    const [kind, setKind] = useState<ClientKind>(client?.kind ?? 'client');
    const [error, setError] = useState<string>();
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const save = async () => {
        const found = validateClientName(name);
        setError(found);
        if (found) return;
        setBusy(true);
        setMessage('');
        try {
            const body = { kind, name: name.trim() };
            if (client) {
                await apiFetch(`/api/work/clients/${client.id}`, { method: 'POST', body });
                onSaved(client.id);
            } else {
                const res = await apiFetch<{ id: number }>('/api/work/clients', { method: 'POST', body });
                onSaved(res.id);
            }
            onClose();
        } catch (e) {
            setMessage(clientErrorText(e));
            setBusy(false);
        }
    };

    return (
        <Modal open title={client ? '업체 고치기' : '새 업체'} onClose={onClose} canClose={() => !busy}>
            {message && (
                <p role="alert" className="mb-3 rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected-fg">
                    {message}
                </p>
            )}
            <div className="flex flex-col gap-4">
                <TextField label="업체 이름" name="clientName" maxLength={100} value={name} error={error} onChange={e => setName(e.target.value)} />
                <label className="flex flex-col gap-1 text-sm font-medium">
                    구분
                    <select className={`${SELECT_CLASS} py-2.5`} value={kind} onChange={e => setKind(e.target.value as ClientKind)}>
                        {(Object.keys(CLIENT_KIND_LABEL) as ClientKind[]).map(k => (
                            <option key={k} value={k}>
                                {CLIENT_KIND_LABEL[k]}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" disabled={busy} onClick={onClose}>
                        취소
                    </Button>
                    <Button disabled={busy} onClick={save}>
                        {busy ? '저장 중…' : '저장'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
