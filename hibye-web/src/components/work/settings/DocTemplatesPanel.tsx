'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { groupTemplates, type Category, type DocTemplateSummary } from '@/lib/contract';
import { DocTemplateEditor } from './DocTemplateEditor';

export const KIND_LABEL = { estimate: '견적서', contract: '계약서' } as const;

// 편집 대상: 기존 양식 id, 새 양식, 또는 기존 양식을 복사한 새 양식
type Editing = number | 'new' | { copyOf: number } | null;

// 양식 — 그룹(기본·고객사)별 목록(종류·이름·분류·기본)과 편집 화면 전환
export function DocTemplatesPanel({
    categories,
    docTemplates,
    refresh,
}: {
    categories: Category[];
    docTemplates: DocTemplateSummary[];
    refresh: () => void;
}) {
    const [editing, setEditing] = useState<Editing>(null);
    const categoryName = (id: number | null) => (id == null ? '공통' : (categories.find(c => c.id === id)?.name ?? '(삭제된 분류)'));
    const grouped = groupTemplates(docTemplates);
    const groups = grouped.map(g => g.group).filter(g => g !== '기본');

    if (editing !== null) {
        const copyOf = typeof editing === 'object' ? editing.copyOf : undefined;
        return (
            <DocTemplateEditor
                key={copyOf ? `copy-${copyOf}` : editing as number | 'new'}
                id={copyOf ? 'new' : (editing as number | 'new')}
                copyFromId={copyOf}
                categories={categories}
                groups={groups}
                onSaved={refresh}
                onCreated={id => {
                    refresh();
                    setEditing(id);
                }}
                onCopy={id => setEditing({ copyOf: id })}
                onClose={() => setEditing(null)}
            />
        );
    }

    return (
        <>
            <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs text-muted">고객사별 양식은 기존 양식을 열어 &apos;복사해서 새 양식&apos;으로 만들고 그룹에 고객사 이름을 적어요.</p>
                <Button onClick={() => setEditing('new')}>새 양식</Button>
            </div>
            {!docTemplates.length ? (
                <EmptyState message="양식이 없어요" />
            ) : (
                <div className="flex flex-col gap-5">
                    {grouped.map(g => (
                        <section key={g.group} aria-label={`${g.group} 양식`}>
                            <h3 className="mb-1 text-sm font-bold">
                                {g.group} <span className="font-normal text-muted">{g.items.length}</span>
                            </h3>
                            <ul className="divide-y divide-line">
                                {g.items.map(t => (
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
                        </section>
                    ))}
                </div>
            )}
        </>
    );
}
