'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Category, DocTemplateSummary } from '@/lib/contract';
import { DocTemplateEditor } from './DocTemplateEditor';

export const KIND_LABEL = { estimate: '견적서', contract: '계약서' } as const;

// 양식 — 목록(종류·이름·분류·기본)과 편집 화면 전환
export function DocTemplatesPanel({
    categories,
    docTemplates,
    refresh,
}: {
    categories: Category[];
    docTemplates: DocTemplateSummary[];
    refresh: () => void;
}) {
    const [editing, setEditing] = useState<number | 'new' | null>(null);
    const categoryName = (id: number | null) => (id == null ? '공통' : (categories.find(c => c.id === id)?.name ?? '(삭제된 분류)'));

    if (editing !== null) {
        return (
            <DocTemplateEditor
                key={editing}
                id={editing}
                categories={categories}
                onSaved={refresh}
                onCreated={id => {
                    refresh();
                    setEditing(id);
                }}
                onClose={() => setEditing(null)}
            />
        );
    }

    return (
        <>
            <div className="mb-3 flex justify-end">
                <Button onClick={() => setEditing('new')}>새 양식</Button>
            </div>
            {!docTemplates.length ? (
                <EmptyState message="양식이 없어요" />
            ) : (
                <ul className="divide-y divide-line">
                    {docTemplates.map(t => (
                        <li key={t.id}>
                            <button
                                type="button"
                                onClick={() => setEditing(t.id)}
                                className="flex w-full flex-wrap items-center gap-3 rounded px-1 py-2.5 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                            >
                                <span className="w-16 shrink-0 text-xs font-semibold text-muted">{KIND_LABEL[t.kind]}</span>
                                <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                                <span className="text-xs text-muted">{categoryName(t.categoryId)}</span>
                                {t.isDefault && <Badge tone="info">기본</Badge>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
