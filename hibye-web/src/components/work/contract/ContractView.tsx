'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch, ApiError } from '@/lib/api';
import { CONTRACT_STATUS_LABEL, contractStatus, receivable, renderItemTable, vat, type ContractDetail, type ContractStatus } from '@/lib/contract';
import { formatWon } from '@/lib/shop';
import { ContractForm } from './ContractForm';

const STATUS_TONE: Record<ContractStatus, BadgeTone> = { active: 'info', unpaid: 'pending', paid: 'approved', hold: 'neutral', cancelled: 'rejected' };

// 계약 상세 — 보기 ↔ 수정 전환, 견적서·계약서 보기, 삭제
export function ContractView({ id }: { id: string }) {
    const router = useRouter();
    const [detail, setDetail] = useState<ContractDetail | null>(null);
    const [loadState, setLoadState] = useState<'loading' | 'ok' | 'notFound' | 'error'>('loading');
    const [editing, setEditing] = useState(false);
    // 새로 불러올 때 폼을 새 값으로 다시 만들기 위한 번호
    const [formKey, setFormKey] = useState(0);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    // 성공 여부를 돌려줌 — 화면 상태(loadState)는 처음 불러올 때만 바꿔, 다시 불러오기 실패가 폼·입력을 지우지 않게
    const load = useCallback(async (): Promise<boolean> => {
        try {
            const r = await apiFetch<{ contract: ContractDetail }>(`/api/work/contracts/${encodeURIComponent(id)}`);
            setDetail(r.contract);
            setLoadState('ok');
            setFormKey(k => k + 1);
            return true;
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) router.replace('/login?redirect=/');
            else setLoadState(prev => (prev === 'ok' ? prev : e instanceof ApiError && e.status === 404 ? 'notFound' : 'error'));
            return false;
        }
    }, [id, router]);

    useEffect(() => {
        // 마운트 때 상세 불러오기 (상태 갱신은 응답 뒤)
        void load();
    }, [load]);

    const remove = async () => {
        if (!detail || !window.confirm('이 계약을 삭제할까요? 품목·담당자도 함께 지워지고 되돌릴 수 없어요.')) return;
        setBusy(true);
        setMessage('');
        try {
            await apiFetch(`/api/work/contracts/${detail.id}`, { method: 'DELETE' });
            router.push('/work/contracts');
        } catch (e) {
            setMessage(e instanceof ApiError && e.status === 404 ? '이미 삭제된 계약이에요.' : '삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
            setBusy(false);
        }
    };

    return (
        <main className="mx-auto w-full max-w-page flex-1 px-4 py-8">
            <p className="mb-3 text-sm">
                <Link href="/work/contracts" className="text-muted hover:text-ink hover:underline">
                    ← 목록으로
                </Link>
            </p>
            {loadState === 'loading' && <Skeleton className="h-96 w-full" />}
            {loadState === 'error' && <ErrorState onRetry={() => void load()} />}
            {loadState === 'notFound' && <ErrorState message="계약을 찾을 수 없어요. 삭제됐거나 주소가 틀렸을 수 있어요." />}
            {detail && loadState === 'ok' && (
                <>
                    {message && (
                        <p role="alert" className="mb-3 rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected-fg">
                            {message}
                        </p>
                    )}
                    {editing ? (
                        <>
                            <h1 className="mb-5 text-2xl font-bold">계약 수정</h1>
                            <ContractForm
                                key={formKey}
                                initial={detail}
                                onCancel={() => setEditing(false)}
                                // 저장 직후: 최신 값을 받은 뒤 보기 모드로 (수정 전 값이 잠깐 보이지 않게). 실패해도 보기 모드 + 안내
                                onSaved={async () => {
                                    setMessage('');
                                    if (!(await load())) setMessage('저장은 됐지만 최신 내용을 불러오지 못했어요. 새로고침해 주세요.');
                                    setEditing(false);
                                }}
                                onReload={async () => {
                                    setMessage('');
                                    if (!(await load())) setMessage('새로 불러오지 못했어요. 입력한 내용은 그대로 있으니 잠시 뒤 다시 눌러 주세요.');
                                }}
                            />
                        </>
                    ) : (
                        <Detail c={detail} busy={busy} onEdit={() => setEditing(true)} onRemove={remove} />
                    )}
                </>
            )}
        </main>
    );
}

function Detail({ c, busy, onEdit, onRemove }: { c: ContractDetail; busy: boolean; onEdit: () => void; onRemove: () => void }) {
    const status = contractStatus(c);
    const debt = receivable(c);
    // renderItemTable은 모든 값을 이스케이프한 HTML만 만들므로 그대로 넣어도 안전 (lib/contract.ts escapeHtml)
    const tableHtml = renderItemTable(c.items);
    return (
        <div className="flex flex-col gap-6 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
                        {c.companyName}
                        <Badge tone={STATUS_TONE[status]}>{CONTRACT_STATUS_LABEL[status]}</Badge>
                    </h1>
                    <p className="mt-1 text-muted">
                        {c.docNo}
                        {c.categoryName ? ` · ${c.categoryName}` : ''}
                        {c.projectName ? ` · ${c.projectName}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href={`/work/contracts/${c.id}/print?kind=estimate`} className={buttonClass('secondary')}>
                        견적서
                    </Link>
                    <Link href={`/work/contracts/${c.id}/print?kind=contract`} className={buttonClass('secondary')}>
                        계약서
                    </Link>
                    <Button variant="secondary" disabled={busy} onClick={onEdit}>
                        수정
                    </Button>
                    <Link href={`/work/contracts/new?from=${c.id}`} className={buttonClass('secondary')}>
                        복사
                    </Link>
                    <Button variant="ghost" className="text-rejected-fg" disabled={busy} onClick={onRemove}>
                        삭제
                    </Button>
                </div>
            </div>

            <Group title="업체">
                <Row label="사업자번호" value={c.bizNo} />
                <Row label="대표자" value={c.ceoName} />
                <Row label="업체 이메일" value={c.companyEmail} />
                <Row label="계약일" value={c.contractDate} />
                <Row label="납품일" value={c.deliveryDate} />
                <Row label="작업기간" value={c.workPeriod} />
            </Group>

            <Group title="담당자">
                {c.managers.length ? (
                    c.managers.map((m, i) => <Row key={m.id ?? i} label={m.name || `담당자 ${i + 1}`} value={[m.phone, m.email, m.memo].filter(Boolean).join(' · ')} wide />)
                ) : (
                    <Row label="담당자" value="" wide />
                )}
            </Group>

            <section>
                <h2 className="mb-2 text-sm font-bold">품목</h2>
                {c.items.length ? (
                    <div
                        className="overflow-x-auto [&_.center]:text-center [&_.red]:text-rejected-fg [&_.right]:text-right [&_.sum]:bg-surface [&_.sum]:font-semibold [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-line [&_th]:bg-surface [&_th]:px-2 [&_th]:py-1.5"
                        dangerouslySetInnerHTML={{ __html: tableHtml }}
                    />
                ) : (
                    <p className="rounded-lg bg-surface px-3 py-4 text-center text-muted">품목이 없어요.</p>
                )}
            </section>

            <Group title="금액 (원)">
                <Row label="합계" value={formatWon(c.total)} />
                <Row label="부가세" value={formatWon(vat(c.total))} />
                <Row label="총액" value={formatWon(c.total + vat(c.total))} />
                <Row label="계약금" value={formatWon(c.deposit)} />
                <Row label="완료금" value={formatWon(c.balance)} />
                <Row label="입금액" value={formatWon(c.paidAmount)} />
                <Row label="미수" value={formatWon(debt)} />
                <Row label="상태" value={`${CONTRACT_STATUS_LABEL[status]}${c.invoiceIssued ? ' · 계산서 발행' : ''}`} />
            </Group>

            <Group title="운영·기타">
                <Row label="운영서버 1" value={c.opsServer1} wide pre />
                <Row label="운영서버 2" value={c.opsServer2} wide pre />
                <Row label="운영비용" value={c.opsSpend} wide pre />
                <Row label="운영 사이트" value={c.opsSite} />
                <Row label="링크 1" value={c.link1} link />
                <Row label="링크 2" value={c.link2} link />
                <Row label="메모" value={c.memo} wide pre />
                <Row label="작성" value={c.createdAt} />
                <Row label="마지막 수정" value={c.updatedAtKst} />
            </Group>
        </div>
    );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="mb-2 text-sm font-bold">{title}</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-line p-4 sm:grid-cols-3">{children}</dl>
        </section>
    );
}

function Row({ label, value, wide, pre, link }: { label: string; value: string | null; wide?: boolean; pre?: boolean; link?: boolean }) {
    // 링크는 서버가 http(s)만 허용하지만, 화면에서도 한 번 더 확인
    const safeLink = link && value && /^https?:\/\//i.test(value);
    return (
        <div className={wide ? 'sm:col-span-3' : ''}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`mt-0.5 break-words ${pre ? 'whitespace-pre-wrap' : ''}`}>
                {safeLink ? (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {value}
                    </a>
                ) : (
                    value || '-'
                )}
            </dd>
        </div>
    );
}
