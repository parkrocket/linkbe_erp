'use client';

import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { Modal } from '@/components/leave/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { digitsOnly, formatWon, validateProductForm, type ProductForm, type ProductRow } from '@/lib/shop';
import { NoticeLine } from './HomepageTab';
import { Pager } from './Pager';
import { deleteProduct, saveProduct, shopErrorMessage } from './homepageApi';
import { ImageField } from './ImageField';
import { RichTextEditor } from './RichTextEditor';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

// 개인결제 상품 — 판매 안 함 상품도 보임(관리용)
export function ProductsPanel() {
    const [page, setPage] = useState(1);
    const { state, reload, refresh } = useApiData<{ products?: ProductRow[]; total?: number }>(
        `/api/admin/shop/products?page=${page}`,
        undefined,
        'GET',
    );
    const [editing, setEditing] = useState<number | 'new' | null>(null);
    const [notice, setNotice] = useState<Notice>(null);
    const rows = state.status === 'ok' ? (state.data.products ?? []) : [];

    return (
        <>
            <NoticeLine notice={notice} />
            <div className="mb-3 flex justify-end">
                <Button onClick={() => setEditing('new')}>상품 추가</Button>
            </div>
            {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
            {state.status === 'error' && <ErrorState onRetry={reload} />}
            {state.status === 'ok' &&
                (!rows.length ? (
                    <EmptyState message="상품이 없어요" />
                ) : (
                    <ul className="divide-y divide-line">
                        {rows.map(r => (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    onClick={() => setEditing(r.id)}
                                    className="flex w-full items-center gap-2 rounded-lg px-1 py-2.5 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                                >
                                    <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                                    {!r.isVisible && <Badge tone="neutral">판매 안 함</Badge>}
                                    <span className="text-xs text-muted">주문 {r.orderCount ?? 0}건</span>
                                    <span className="tabular-nums">{formatWon(r.price)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ))}
            {state.status === 'ok' && <Pager page={page} total={state.data.total ?? 0} onPage={setPage} />}
            {editing !== null && (
                <ProductDialog
                    id={editing === 'new' ? null : editing}
                    onClose={() => setEditing(null)}
                    onDone={text => {
                        setEditing(null);
                        setNotice({ tone: 'ok', text });
                        refresh();
                    }}
                />
            )}
        </>
    );
}

function ProductDialog({ id, onClose, onDone }: { id: number | null; onClose: () => void; onDone: (text: string) => void }) {
    // 저장하지 않은 변경이 있으면 닫기 전 확인 (배경 클릭·Esc 포함)
    const [dirty, setDirty] = useState(false);
    return (
        <Modal
            open
            size="lg"
            title={id ? '상품 수정' : '상품 추가'}
            onClose={onClose}
            canClose={() => !dirty || window.confirm('저장하지 않은 변경이 있어요. 닫을까요?')}
        >
            {id === null ? (
                <ProductEditor onDone={onDone} onDirty={() => setDirty(true)} />
            ) : (
                <ExistingProduct id={id} onDone={onDone} onDirty={() => setDirty(true)} />
            )}
        </Modal>
    );
}

function ExistingProduct({ id, onDone, onDirty }: { id: number; onDone: (text: string) => void; onDirty: () => void }) {
    const { state, reload } = useApiData<{ product?: ProductRow }>(`/api/admin/shop/products/${id}`, undefined, 'GET');
    if (state.status === 'loading') return <Skeleton className="h-64 w-full" />;
    if (state.status === 'error' || !state.data.product) return <ErrorState onRetry={reload} />;
    return <ProductEditor product={state.data.product} onDone={onDone} onDirty={onDirty} />;
}

const toForm = (p?: ProductRow): ProductForm => ({
    title: p?.title ?? '',
    price: p ? String(p.price) : '',
    bodyHtml: p?.bodyHtml ?? '',
    imageFileId: p?.imageFileId ?? null,
    isVisible: p ? p.isVisible : true,
    sortOrder: String(p?.sortOrder ?? 0),
});

function ProductEditor({ product, onDone, onDirty }: { product?: ProductRow; onDone: (text: string) => void; onDirty: () => void }) {
    const [form, setForm] = useState<ProductForm>(() => toForm(product));
    const [errors, setErrors] = useState<ReturnType<typeof validateProductForm>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
        onDirty();
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const save = async () => {
        const found = validateProductForm(form);
        setErrors(found);
        if (Object.keys(found).length) return;
        setSaving(true);
        setError('');
        try {
            // updatedAt은 상세에서 받은 문자열 그대로 (서버가 그 사이 수정 여부 판단)
            await saveProduct(product?.id ?? null, form, product?.updatedAt);
            onDone('저장했어요.');
        } catch (e) {
            setError(shopErrorMessage(e));
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!product || !window.confirm(`'${product.title}' 상품을 삭제할까요?`)) return;
        try {
            await deleteProduct(product.id);
            onDone('삭제했어요.');
        } catch (e) {
            setError(shopErrorMessage(e));
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <TextField label="상품명" name="title" maxLength={200} value={form.title} onChange={e => set('title', e.target.value)} error={errors.title} />
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="가격 (원)"
                    name="price"
                    inputMode="numeric"
                    value={form.price ? Number(form.price).toLocaleString('ko-KR') : ''}
                    onChange={e => set('price', digitsOnly(e.target.value))}
                    error={errors.price}
                />
                <TextField
                    label="순서 (클수록 앞)"
                    name="sortOrder"
                    inputMode="numeric"
                    value={form.sortOrder}
                    onChange={e => set('sortOrder', digitsOnly(e.target.value))}
                    error={errors.sortOrder}
                />
            </div>
            <ImageField label="대표 이미지" fileId={form.imageFileId} onChange={fid => set('imageFileId', fid)} />
            <RichTextEditor label="설명" value={form.bodyHtml} onChange={html => set('bodyHtml', html)} />
            <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.isVisible} onChange={e => set('isVisible', e.target.checked)} className="size-4 accent-primary" />
                판매하기 (끄면 판매 안 함)
            </label>
            {error && (
                <p role="alert" className="text-sm text-rejected-fg">
                    {error}
                </p>
            )}
            <div className="flex justify-end gap-2">
                {product && (
                    <Button variant="ghost" className="mr-auto text-rejected-fg" onClick={remove}>
                        삭제
                    </Button>
                )}
                <Button disabled={saving} onClick={save}>
                    {saving ? '저장 중…' : '저장'}
                </Button>
            </div>
        </div>
    );
}
