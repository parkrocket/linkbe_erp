'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NoticeLine } from '@/components/admin/homepage/HomepageTab';
import { RichTextEditor } from '@/components/admin/homepage/RichTextEditor';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { PrintFrame } from '@/components/work/contract/PrintView';
import { apiFetch, ApiError } from '@/lib/api';
import {
    buildPrintDocument,
    buildPrintValues,
    fillTemplate,
    PLACEHOLDERS,
    renderItemTable,
    type Category,
    type ContractDetail,
    type DocKind,
    type DocTemplate,
} from '@/lib/contract';
import { kstDate } from '@/lib/schedule';
import { deleteSetting, postSetting, settingsError, SETTINGS_API, type Notice } from './settingsApi';

// 미리보기용 가짜 계약 — 실제 업체 값은 쓰지 않음
const SAMPLE_CONTRACT: ContractDetail = {
    id: 0,
    docNo: '20000101-0900',
    categoryId: null,
    categoryName: '샘플 분류',
    companyName: '테스트업체',
    bizNo: '000-00-00000',
    ceoName: '홍길동',
    companyEmail: 'test@example.com',
    projectName: '샘플 프로젝트',
    contractDate: '2000-01-01',
    deliveryDate: '2000-02-01',
    workPeriod: '30일',
    memo: '샘플 메모',
    link1: '',
    link2: '',
    total: 1_500_000,
    deposit: 750_000,
    balance: 750_000,
    paidAmount: 750_000,
    isHold: false,
    isCancelled: false,
    isPaidFull: false,
    invoiceIssued: false,
    opsServer1: '샘플 서버1',
    opsServer2: '샘플 서버2',
    opsSpend: '월 10,000',
    opsSite: 'example.com',
    createdAt: '2000-01-01 09:00:00',
    updatedAt: '',
    updatedAtKst: '',
    items: [
        { groupName: '개발', content: '샘플 기능 개발', unitPrice: 1_000_000, qty: 1, period: 1, note: '', kind: 'normal' },
        { groupName: '유지보수', content: '샘플 유지보수', unitPrice: 100_000, qty: 1, period: 6, note: '월 단위', kind: 'normal' },
        { groupName: '할인', content: '샘플 할인', unitPrice: -100_000, qty: 1, period: 1, note: '', kind: 'discount' },
    ],
    managers: [{ name: '김담당', phone: '010-0000-0000', email: 'manager@example.com', memo: '' }],
};

type Form = { name: string; kind: DocKind; categoryId: string; isDefault: boolean; bodyHtml: string; css: string };
const EMPTY_FORM: Form = { name: '', kind: 'estimate', categoryId: '', isDefault: false, bodyHtml: '', css: '' };

// 양식 편집 — id가 'new'면 새 양식. 본문은 편집기, 모양(CSS)은 접어 둔 칸, 오른쪽은 자리표시 목록
export function DocTemplateEditor({
    id,
    categories,
    onSaved,
    onCreated,
    onClose,
}: {
    id: number | 'new';
    categories: Category[];
    onSaved: () => void;
    onCreated: (id: number) => void;
    onClose: () => void;
}) {
    const [form, setForm] = useState<Form>(EMPTY_FORM);
    const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined); // 동시 수정 검사용
    const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>(id === 'new' ? 'ok' : 'loading');
    const [editorKey, setEditorKey] = useState(0); // 새로 불러올 때 편집기를 다시 만듦
    const [notice, setNotice] = useState<Notice>(null);
    const [busy, setBusy] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [conflict, setConflict] = useState(false);
    const editorBox = useRef<HTMLDivElement>(null);
    const [today] = useState(() => kstDate(Date.now())); // 미리보기의 {오늘}

    // 저장된 양식 불러오기 (처음·409 뒤 새로 불러오기). replaceForm=false면 updatedAt만 갱신
    const load = useCallback(
        async (replaceForm: boolean) => {
            if (id === 'new') return;
            try {
                const { docTemplate: t } = await apiFetch<{ docTemplate: DocTemplate }>(`${SETTINGS_API}/doc-templates/${id}`);
                setUpdatedAt(t.updatedAt);
                if (replaceForm) {
                    setForm({ name: t.name, kind: t.kind, categoryId: t.categoryId == null ? '' : String(t.categoryId), isDefault: t.isDefault, bodyHtml: t.bodyHtml, css: t.css });
                    setEditorKey(k => k + 1);
                }
                setLoadState('ok');
                return true;
            } catch (e) {
                if (replaceForm) setLoadState('error');
                else setNotice({ tone: 'error', text: settingsError(e) });
                return false;
            }
        },
        [id],
    );

    useEffect(() => {
        // 응답 도착 때 상태를 바꾸는 일반적인 불러오기
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load(true);
    }, [load]);

    const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }));

    const save = async () => {
        if (busy) return;
        if (!form.name.trim()) return setNotice({ tone: 'error', text: '양식 이름을 입력해 주세요.' });
        setBusy(true);
        try {
            const body = {
                kind: form.kind,
                name: form.name.trim(),
                categoryId: form.categoryId ? Number(form.categoryId) : null,
                bodyHtml: form.bodyHtml,
                css: form.css,
                isDefault: form.isDefault,
            };
            if (id === 'new') {
                const r = await postSetting('/doc-templates', body);
                if (r.id) onCreated(r.id);
                return;
            }
            await postSetting(`/doc-templates/${id}`, { ...body, updatedAt });
            await load(false); // 새 수정 시각만 받아 옴 (입력 내용은 그대로)
            setConflict(false);
            setNotice({ tone: 'ok', text: '저장했어요.' });
            onSaved();
        } catch (e) {
            // 입력 내용은 지우지 않고 안내만
            setConflict(e instanceof ApiError && e.reason === 'Template changed');
            setNotice({ tone: 'error', text: settingsError(e) });
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (id === 'new' || busy) return;
        if (!window.confirm(`'${form.name || '이 양식'}' 양식을 삭제할까요? 되돌릴 수 없어요.`)) return;
        setBusy(true);
        try {
            await deleteSetting(`/doc-templates/${id}`);
            onSaved();
            onClose();
        } catch (e) {
            setNotice({ tone: 'error', text: settingsError(e) });
            setBusy(false);
        }
    };

    // 자리표시: 편집기 안에 커서가 있으면 그 자리에 넣고, 아니면 복사
    const insertPlaceholder = async (key: string) => {
        const text = `{${key}}`;
        const anchor = window.getSelection()?.anchorNode;
        const inEditor = anchor && editorBox.current?.contains(anchor) && anchor.parentElement?.closest('[contenteditable="true"]');
        if (inEditor && document.execCommand('insertText', false, text)) return;
        try {
            await navigator.clipboard.writeText(text);
            setNotice({ tone: 'ok', text: `${text} 를 복사했어요. 본문에 붙여 넣어 주세요.` });
        } catch {
            setNotice({ tone: 'error', text: `복사하지 못했어요. ${text} 를 직접 입력해 주세요.` });
        }
    };

    // 미리보기 — 가짜 계약 값으로 채움 (스크립트가 막힌 iframe)
    const previewHtml = useMemo(() => {
        if (!showPreview) return '';
        const filled = fillTemplate(form.bodyHtml, buildPrintValues(SAMPLE_CONTRACT, today), renderItemTable(SAMPLE_CONTRACT.items));
        return buildPrintDocument(form.css, filled, '양식 미리보기');
    }, [showPreview, form.bodyHtml, form.css, today]);

    if (loadState === 'loading') return <Skeleton className="h-96 w-full" />;
    if (loadState === 'error') return <ErrorState onRetry={() => (setLoadState('loading'), void load(true))} />;

    return (
        <>
            <p className="mb-3 text-sm">
                <button type="button" onClick={onClose} className="text-muted hover:text-ink hover:underline">
                    ← 양식 목록
                </button>
            </p>
            <NoticeLine notice={notice} />
            {conflict && (
                <p className="mb-3 text-sm">
                    <Button variant="secondary" onClick={() => (void load(true), setConflict(false), setNotice({ tone: 'ok', text: '새로 불러왔어요. (내가 고친 내용은 사라졌어요)' }))}>
                        새로 불러오기
                    </Button>{' '}
                    <span className="text-muted">누르면 지금 입력한 내용은 사라져요. 필요하면 먼저 복사해 두세요.</span>
                </p>
            )}
            <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
                <div className="flex min-w-0 flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <TextField label="이름" value={form.name} maxLength={100} onChange={e => set('name', e.target.value)} />
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            종류
                            <select
                                value={form.kind}
                                onChange={e => set('kind', e.target.value as DocKind)}
                                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-normal"
                            >
                                <option value="estimate">견적서</option>
                                <option value="contract">계약서</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            분류
                            <select
                                value={form.categoryId}
                                onChange={e => set('categoryId', e.target.value)}
                                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-normal"
                            >
                                <option value="">공통</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
                            <input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} className="size-4" />
                            이 분류·종류의 기본 양식
                        </label>
                    </div>
                    <div ref={editorBox}>
                        <RichTextEditor key={editorKey} label="본문" value={form.bodyHtml} onChange={html => set('bodyHtml', html)} allowImage={false} allowTable allowSource />
                    </div>
                    <details className="rounded-lg border border-line">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">고급: 인쇄 모양(CSS)</summary>
                        <textarea
                            aria-label="인쇄 모양(CSS)"
                            value={form.css}
                            onChange={e => set('css', e.target.value)}
                            spellCheck={false}
                            rows={10}
                            className="w-full resize-y border-t border-line p-3 font-mono text-xs outline-none"
                        />
                    </details>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button disabled={busy} onClick={save}>
                            {busy ? '저장 중…' : '저장'}
                        </Button>
                        <Button variant="secondary" onClick={() => setShowPreview(v => !v)}>
                            {showPreview ? '미리보기 닫기' : '미리보기'}
                        </Button>
                        {id !== 'new' && (
                            <Button variant="ghost" className="ml-auto" disabled={busy} onClick={remove}>
                                삭제
                            </Button>
                        )}
                    </div>
                </div>
                <aside aria-label="자리표시 목록" className="min-w-0">
                    <h2 className="mb-1 text-sm font-bold">자리표시</h2>
                    <p className="mb-2 text-xs text-muted">본문에 커서를 두고 누르면 그 자리에 들어가요. 커서가 없으면 복사돼요.</p>
                    <ul className="flex max-h-96 flex-wrap gap-1 overflow-y-auto lg:max-h-[32rem]">
                        {PLACEHOLDERS.map(p => (
                            <li key={p.key}>
                                <button
                                    type="button"
                                    title={p.label}
                                    onMouseDown={e => e.preventDefault()} // 눌러도 본문 커서가 풀리지 않게
                                    onClick={() => insertPlaceholder(p.key)}
                                    className="rounded border border-line bg-surface px-2 py-1 text-xs hover:bg-neutral-bg focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    {`{${p.key}}`}
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>
            </div>
            {showPreview && (
                <div className="mt-4">
                    <p className="mb-2 text-xs text-muted">가짜 값(테스트업체·홍길동 등)으로 채운 미리보기예요. 품목 3개(개발·유지보수·할인) 기준이에요.</p>
                    <PrintFrame html={previewHtml} title="양식 미리보기" />
                </div>
            )}
        </>
    );
}
