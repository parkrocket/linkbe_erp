'use client';

import { Paperclip } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
    CONTACT_METHOD_LABEL,
    INQUIRY_CATEGORY_LABEL,
    INQUIRY_KIND_LABEL,
    INQUIRY_STATUS_LABEL,
    type InquiryFile,
    type InquiryRow,
    type InquiryStatus,
} from '@/lib/homepage';
import { NoticeLine } from './HomepageTab';
import { Pager } from './Pager';
import { homepageErrorMessage, inquiryFileUrl, updateInquiry } from './homepageApi';

const STATUS_TONE: Record<InquiryStatus, BadgeTone> = { new: 'pending', in_progress: 'info', done: 'approved' };
const WHEN = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const SELECT =
    'rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft';

// 문의함 — 1:1 문의·견적 요청. 목록은 이름·회사만, 연락처·내용은 상세에서만(개인정보 최소)
export function InquiriesPanel() {
    const router = useRouter();
    const [kind, setKind] = useState('');
    const [status, setStatus] = useState('');
    const [opened, setOpened] = useState<number | null>(null);
    const [page, setPage] = useState(1);
    const query = new URLSearchParams({ ...(kind && { kind }), ...(status && { status }), page: String(page) }).toString();
    const { state, reload, refresh } = useApiData<{ rows?: InquiryRow[]; total?: number }>(
        `/api/admin/homepage/inquiries?${query}`,
        undefined,
        'GET',
    );
    const rows = state.status === 'ok' ? (state.data.rows ?? []) : [];

    return (
        <>
            <div className="mb-3 flex flex-wrap gap-2">
                <select aria-label="종류" className={SELECT} value={kind} onChange={e => (setKind(e.target.value), setPage(1))}>
                    <option value="">전체 종류</option>
                    {Object.entries(INQUIRY_KIND_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                            {l}
                        </option>
                    ))}
                </select>
                <select aria-label="상태" className={SELECT} value={status} onChange={e => (setStatus(e.target.value), setPage(1))}>
                    <option value="">전체 상태</option>
                    {Object.entries(INQUIRY_STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                            {l}
                        </option>
                    ))}
                </select>
            </div>
            {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (!rows.length ? (
                    <EmptyState message="문의가 없어요" />
                ) : (
                    <ul className="divide-y divide-line">
                        {rows.map(r => (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    onClick={() => setOpened(r.id)}
                                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 py-2.5 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    <Badge tone={STATUS_TONE[r.status]}>{INQUIRY_STATUS_LABEL[r.status]}</Badge>
                                    <span className="text-xs text-muted">{INQUIRY_KIND_LABEL[r.kind]}</span>
                                    <span className="font-bold">{r.company}</span>
                                    <span>{r.name}</span>
                                    {r.category && (
                                        <span className="text-xs text-muted">{INQUIRY_CATEGORY_LABEL[r.category] ?? r.category}</span>
                                    )}
                                    <span className="ml-auto text-xs text-muted">{WHEN.format(new Date(r.created_at))}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ))}
            {state.status === 'ok' && <Pager page={page} total={state.data.total ?? 0} onPage={setPage} />}
            {opened !== null && (
                <InquiryDialog
                    id={opened}
                    onClose={() => setOpened(null)}
                    onSaved={() => {
                        refresh();
                        router.refresh(); // 사이드 메뉴 '문의함' 배지(서버 layout에서 셈)
                    }}
                />
            )}
        </>
    );
}

function InquiryDialog({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
    const { state, reload } = useApiData<{ inquiry?: InquiryRow; files?: InquiryFile[] }>(
        `/api/admin/homepage/inquiries/${id}`,
        undefined,
        'GET',
    );
    const inquiry = state.status === 'ok' ? state.data.inquiry : undefined;
    return (
        <Modal open size="lg" title={inquiry ? `${INQUIRY_KIND_LABEL[inquiry.kind]} — ${inquiry.company}` : '문의'} onClose={onClose}>
            {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {inquiry && (
                <InquiryDetail
                    key={inquiry.id}
                    inquiry={inquiry}
                    files={state.status === 'ok' ? (state.data.files ?? []) : []}
                    onSaved={onSaved}
                />
            )}
        </Modal>
    );
}

function InquiryDetail({ inquiry, files, onSaved }: { inquiry: InquiryRow; files: InquiryFile[]; onSaved: () => void }) {
    const [status, setStatus] = useState<InquiryStatus>(inquiry.status);
    const [memo, setMemo] = useState(inquiry.admin_memo ?? '');
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

    const save = async () => {
        setSaving(true);
        setNotice(null);
        try {
            await updateInquiry(inquiry.id, { status, adminMemo: memo });
            setNotice({ tone: 'ok', text: '저장했어요.' });
            onSaved();
        } catch (e) {
            setNotice({ tone: 'error', text: homepageErrorMessage(e) });
        } finally {
            setSaving(false);
        }
    };

    const rows: [string, React.ReactNode][] = [
        ['접수', new Date(inquiry.created_at).toLocaleString('ko-KR')],
        ['이름', inquiry.name],
        ['회사', inquiry.company],
        ['연락처', inquiry.phone],
        ['이메일', inquiry.email || '-'],
        ...(inquiry.kind === 'estimate'
            ? ([
                  ['제작 분류', INQUIRY_CATEGORY_LABEL[inquiry.category ?? ''] ?? inquiry.category ?? '-'],
                  ['연락 수단', CONTACT_METHOD_LABEL[inquiry.contact_method ?? ''] ?? '-'],
              ] as [string, React.ReactNode][])
            : []),
    ];

    return (
        <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1.5 rounded-lg bg-surface p-3 text-sm">
                {rows.map(([k, v]) => (
                    <div key={k} className="contents">
                        <dt className="text-muted">{k}</dt>
                        <dd className="break-words">{v || '-'}</dd>
                    </div>
                ))}
            </dl>
            <div>
                <p className="mb-1 text-sm font-medium">내용</p>
                {/* 고객이 쓴 글 — HTML로 해석하지 않고 글자 그대로 */}
                <p className="whitespace-pre-wrap break-words rounded-lg border border-line p-3 text-sm">{inquiry.body}</p>
            </div>
            {files.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm">
                    {files.map(f => (
                        <li key={f.id}>
                            <a
                                href={inquiryFileUrl(inquiry.id, f.id)}
                                className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
                            >
                                <Paperclip aria-hidden className="size-4" />
                                {f.name} <span className="text-xs text-muted">({Math.ceil(f.size / 1024)}KB)</span>
                            </a>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex flex-col gap-2 border-t border-line pt-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                    처리 상태
                    <select className={SELECT} value={status} onChange={e => setStatus(e.target.value as InquiryStatus)}>
                        {Object.entries(INQUIRY_STATUS_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>
                                {l}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                    관리 메모 (고객에게 보이지 않음)
                    <textarea
                        rows={3}
                        maxLength={2000}
                        value={memo}
                        onChange={e => setMemo(e.target.value)}
                        className="rounded-lg border border-line px-3 py-2 text-sm font-normal focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft"
                    />
                </label>
                <NoticeLine notice={notice} />
                <Button className="self-end" disabled={saving} onClick={save}>
                    {saving ? '저장 중…' : '저장'}
                </Button>
            </div>
        </div>
    );
}
