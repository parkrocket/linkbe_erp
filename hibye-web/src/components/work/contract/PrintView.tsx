'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { todayString } from '@/components/dashboard/useApiData';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch, ApiError } from '@/lib/api';
import {
    buildPrintDocument,
    buildPrintValues,
    fillTemplate,
    pickTemplate,
    PRINT_SANDBOX,
    renderItemTable,
    type ContractDetail,
    type DocKind,
    type DocTemplate,
    type DocTemplateSummary,
} from '@/lib/contract';

// A4 기본 높이(96dpi 기준 약 1123px) — 문서 높이를 못 재면 이 값
const A4_HEIGHT = 1123;

// 격리된 인쇄 미리보기 — 스크립트 실행 불가 iframe. 설정 화면 미리보기(가짜 계약 값)에서도 재사용
export function PrintFrame({ html, title }: { html: string; title: string }) {
    const ref = useRef<HTMLIFrameElement>(null);
    const [height, setHeight] = useState(A4_HEIGHT);

    // 로드 뒤 문서 높이로 맞춤 (같은 출처 허용이라 접근 가능, 실패하면 기본값)
    const fit = () => {
        try {
            const h = ref.current?.contentDocument?.documentElement.scrollHeight;
            if (h && h > 0) setHeight(h);
        } catch {
            setHeight(A4_HEIGHT);
        }
    };

    return (
        <div className="overflow-x-auto rounded-lg border border-line bg-neutral-bg p-4">
            <iframe
                ref={ref}
                title={title}
                srcDoc={html}
                sandbox={PRINT_SANDBOX}
                onLoad={fit}
                className="mx-auto block w-[794px] max-w-none bg-white shadow"
                style={{ height }}
            />
        </div>
    );
}

// 인쇄 — 같은 출처 iframe에서 브라우저 인쇄 창
export function printFrame(root: HTMLElement | null) {
    root?.querySelector('iframe')?.contentWindow?.print();
}

// 견적서·계약서 인쇄 화면
export function PrintView({ id, kind, templateId }: { id: string; kind: DocKind; templateId: number | null }) {
    const router = useRouter();
    const frameBox = useRef<HTMLDivElement>(null);
    const [contract, setContract] = useState<ContractDetail | null>(null);
    const [templates, setTemplates] = useState<DocTemplateSummary[] | null>(null);
    const [loadState, setLoadState] = useState<'loading' | 'ok' | 'notFound' | 'error'>('loading');
    const [tryNo, setTryNo] = useState(0);

    // 계약 + 양식 목록
    useEffect(() => {
        let alive = true;
        Promise.all([
            apiFetch<{ contract: ContractDetail }>(`/api/work/contracts/${encodeURIComponent(id)}`),
            apiFetch<{ docTemplates: DocTemplateSummary[] }>('/api/work/doc-settings'),
        ])
            .then(([c, t]) => {
                if (!alive) return;
                setContract(c.contract);
                setTemplates(t.docTemplates);
                setLoadState('ok');
            })
            .catch(e => {
                if (!alive) return;
                if (e instanceof ApiError && e.status === 401) router.replace('/login?redirect=/');
                else setLoadState(e instanceof ApiError && e.status === 404 ? 'notFound' : 'error');
            });
        return () => {
            alive = false;
        };
    }, [id, router, tryNo]);

    const sameKind = useMemo(() => (templates || []).filter(t => t.kind === kind).sort((a, b) => a.id - b.id), [templates, kind]);
    // 쿼리의 양식이 이 종류에 없으면 기본 고르기
    const picked = useMemo(
        () => sameKind.find(t => t.id === templateId) || pickTemplate(templates || [], kind, contract?.categoryId ?? null),
        [sameKind, templateId, templates, kind, contract],
    );

    // 고른 양식 본문
    const [body, setBody] = useState<{ id: number; tpl: DocTemplate } | null>(null);
    const [bodyError, setBodyError] = useState(false);
    const pickedId = picked?.id ?? null;
    useEffect(() => {
        if (pickedId == null) return;
        let alive = true;
        apiFetch<{ docTemplate: DocTemplate }>(`/api/work/doc-settings/doc-templates/${pickedId}`)
            .then(r => {
                if (!alive) return;
                setBodyError(false);
                setBody({ id: pickedId, tpl: r.docTemplate });
            })
            .catch(() => alive && setBodyError(true));
        return () => {
            alive = false;
        };
    }, [pickedId, tryNo]);

    const html = useMemo(() => {
        if (!contract || !body || body.id !== pickedId) return '';
        const filled = fillTemplate(body.tpl.bodyHtml, buildPrintValues(contract, todayString()), renderItemTable(contract.items));
        return buildPrintDocument(body.tpl.css, filled, `${contract.docNo} ${body.tpl.name}`);
    }, [contract, body, pickedId]);

    const kindLabel = kind === 'estimate' ? '견적서' : '계약서';
    // 양식을 바꾸면 주소만 바꿈(새로 불러오지 않고 쿼리로 다시 그림)
    const choose = (tid: string) => router.replace(`/work/contracts/${encodeURIComponent(id)}/print?kind=${kind}&template=${tid}`);

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <p className="mb-3 text-sm">
                <Link href={`/work/contracts/${encodeURIComponent(id)}`} className="text-muted hover:text-ink hover:underline">
                    ← 돌아가기
                </Link>
            </p>
            {loadState === 'loading' && <Skeleton className="h-96 w-full" />}
            {loadState === 'error' && <ErrorState onRetry={() => setTryNo(n => n + 1)} />}
            {loadState === 'notFound' && <ErrorState message="계약을 찾을 수 없어요. 삭제됐거나 주소가 틀렸을 수 있어요." />}
            {loadState === 'ok' && contract && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h1 className="text-2xl font-bold">
                            {kindLabel} — {contract.companyName}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2">
                            {sameKind.length > 0 && (
                                <select
                                    aria-label="양식 고르기"
                                    value={picked?.id ?? ''}
                                    onChange={e => choose(e.target.value)}
                                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                                >
                                    {sameKind.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <Button disabled={!html} onClick={() => printFrame(frameBox.current)}>
                                인쇄
                            </Button>
                        </div>
                    </div>
                    {!picked ? (
                        <p className="rounded-lg bg-neutral-bg px-4 py-6 text-center text-sm text-muted">
                            이 종류의 양식이 없어요 — 설정에서 양식을 추가해 주세요.{' '}
                            <Link href="/work/settings" className="font-medium text-ink underline">
                                설정으로 가기
                            </Link>
                        </p>
                    ) : bodyError ? (
                        <ErrorState message="양식을 불러오지 못했어요." onRetry={() => setTryNo(n => n + 1)} />
                    ) : !html ? (
                        <Skeleton className="h-96 w-full" />
                    ) : (
                        <div ref={frameBox}>
                            <PrintFrame html={html} title={`${kindLabel} 미리보기`} />
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}
