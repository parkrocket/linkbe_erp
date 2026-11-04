'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError, apiFetch } from '@/lib/api';
import { clientErrorText, CLIENT_KIND_LABEL, logText, REVEAL_MS, type ClientDetailData, type Credential } from '@/lib/clients';
import { ClientFiles } from './ClientFiles';
import { ClientFormDialog } from './ClientList';
import { CredentialDialog } from './CredentialDialog';
import { CredentialRow } from './CredentialRow';

// 업체 상세 — 항목·예전 메모·첨부·최근 기록
export function ClientDetail({ id }: { id: string }) {
    const router = useRouter();
    const valid = /^[1-9]\d{0,14}$/.test(id);
    const clientId = Number(id);
    // 잘못된 주소는 요청하지 않음. 404는 '찾을 수 없음' 화면(useApiData는 404를 일반 오류로 뭉뚱그려 직접 조회)
    const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'missing' } | { status: 'ok'; data: ClientDetailData }>({ status: 'loading' });
    const load = useCallback(async (): Promise<typeof state | null> => {
        try {
            return { status: 'ok', data: await apiFetch<ClientDetailData>(`/api/work/clients/${clientId}`) };
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
                router.replace('/login?redirect=/work/clients');
                return null;
            }
            return { status: e instanceof ApiError && e.status === 404 ? 'missing' : 'error' };
        }
    }, [clientId, router]);
    useEffect(() => {
        if (!valid) return;
        let active = true; // 화면을 떠난 뒤 도착한 응답은 무시
        load().then(next => active && next && setState(next));
        return () => {
            active = false;
        };
    }, [valid, load]);
    const refresh = () => void load().then(next => next && setState(next));
    const reload = () => {
        setState({ status: 'loading' });
        refresh();
    };
    const [dialog, setDialog] = useState<'new' | Credential | 'client' | null>(null);
    const [message, setMessage] = useState('');
    const [legacy, setLegacy] = useState<string | null>(null); // 예전 메모 평문 — state에만, 접기·화면 이동 시 사라짐
    const [legacyBusy, setLegacyBusy] = useState(false);

    if (!valid || state.status === 'missing') return <Missing />;
    if (state.status === 'loading') return <Skeleton className="mx-auto mt-10 h-96 w-full max-w-5xl" />;
    if (state.status === 'error')
        return (
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
                <ErrorState onRetry={reload} />
            </main>
        );

    const { client, credentials, files, logs } = state.data;

    const showLegacy = async () => {
        setLegacyBusy(true);
        setMessage('');
        try {
            const res = await apiFetch<{ value: string | null }>(`/api/work/clients/${clientId}/legacy-memo/reveal`, { method: 'POST', body: { action: 'view' } });
            if (res.value === null) setMessage('예전 메모를 읽을 수 없어요. 암호화 키를 확인해 주세요.');
            else setLegacy(res.value);
        } catch (e) {
            setMessage(clientErrorText(e));
        }
        setLegacyBusy(false);
    };

    const removeCredential = async (c: Credential) => {
        if (!window.confirm(`'${c.label || '(이름 없음)'}' 항목을 삭제할까요? 되돌릴 수 없어요.`)) return;
        setMessage('');
        try {
            await apiFetch(`/api/work/clients/${clientId}/credentials/${c.id}`, { method: 'DELETE' });
            refresh();
        } catch (e) {
            setMessage(clientErrorText(e));
        }
    };

    const removeClient = async () => {
        if (!window.confirm(`'${client.name}' 업체를 삭제할까요?\n항목·첨부가 모두 지워져요(기록은 남아요)`)) return;
        setMessage('');
        try {
            await apiFetch(`/api/work/clients/${clientId}`, { method: 'DELETE' });
            router.push('/work/clients');
        } catch (e) {
            setMessage(clientErrorText(e));
        }
    };

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <Link href="/work/clients" className="text-sm text-muted hover:text-ink hover:underline">
                ← 업체 목록
            </Link>
            <div className="mt-2 mb-5 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{client.name}</h1>
                <span className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted">{CLIENT_KIND_LABEL[client.kind]}</span>
                <span className="ml-auto flex gap-2">
                    <Button variant="secondary" onClick={() => setDialog('client')}>
                        업체 고치기
                    </Button>
                    <Button variant="ghost" className="text-rejected-fg" onClick={removeClient}>
                        업체 삭제
                    </Button>
                </span>
            </div>

            {message && (
                <p role="alert" className="mb-3 rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected-fg">
                    {message}
                </p>
            )}

            <section aria-labelledby="client-credentials">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 id="client-credentials" className="text-lg font-bold">
                        접속정보
                    </h2>
                    <Button onClick={() => setDialog('new')}>항목 추가</Button>
                </div>
                <p className="mb-2 text-xs text-muted">비밀번호·메모는 평소 가려져 있고, 보기·복사하면 기록이 남아요. 보기는 {REVEAL_MS / 1000}초 뒤 다시 가려져요.</p>
                {credentials.length ? (
                    <ul className="flex flex-col gap-2">
                        {credentials.map(c => (
                            <CredentialRow key={`${c.id}-${c.updatedAt}`} clientId={clientId} credential={c} onEdit={() => setDialog(c)} onDelete={() => removeCredential(c)} />
                        ))}
                    </ul>
                ) : (
                    <EmptyState message="등록된 항목이 없어요." />
                )}
            </section>

            {client.hasLegacyMemo && (
                <section aria-labelledby="client-legacy" className="mt-8">
                    <h2 id="client-legacy" className="mb-2 text-lg font-bold">
                        예전 메모
                    </h2>
                    {client.legacyMemoUnreadable ? (
                        <p className="text-sm text-rejected-fg">읽을 수 없어요. 암호화 키를 확인해 주세요.</p>
                    ) : legacy === null ? (
                        <Button variant="secondary" disabled={legacyBusy} onClick={showLegacy}>
                            {legacyBusy ? '불러오는 중…' : '예전 메모 보기'}
                        </Button>
                    ) : (
                        <div>
                            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 font-sans text-sm">{legacy}</pre>
                            <Button variant="secondary" className="mt-2" onClick={() => setLegacy(null)}>
                                접기
                            </Button>
                        </div>
                    )}
                </section>
            )}

            <ClientFiles clientId={clientId} files={files} onChanged={refresh} />

            <section aria-labelledby="client-logs" className="mt-8">
                <h2 id="client-logs" className="mb-2 text-lg font-bold">
                    최근 기록
                </h2>
                {logs.length ? (
                    <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                        {logs.slice(0, 30).map((l, i) => (
                            <li key={i} className="flex flex-wrap gap-x-3 px-3 py-2">
                                <span className="tabular-nums text-muted">{l.createdAt.slice(0, 16)}</span>
                                <span>{logText(l)}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted">기록이 없어요.</p>
                )}
            </section>

            {(dialog === 'new' || (dialog && typeof dialog === 'object')) && (
                <CredentialDialog clientId={clientId} credential={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} onChanged={refresh} />
            )}
            {dialog === 'client' && <ClientFormDialog client={client} onClose={() => setDialog(null)} onSaved={refresh} />}
        </main>
    );
}

function Missing() {
    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <EmptyState message="업체를 찾을 수 없어요." />
            <Link href="/work/clients" className="block text-center text-sm text-primary hover:underline">
                업체 목록으로
            </Link>
        </main>
    );
}
