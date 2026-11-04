'use client';

import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Category, DocTemplateSummary } from '@/lib/contract';
import { SETTINGS_API } from './settingsApi';
import { AccountsPanel } from './AccountsPanel';
import { CategoriesPanel } from './CategoriesPanel';
import { DocTemplatesPanel } from './DocTemplatesPanel';
import { ItemTemplatesPanel } from './ItemTemplatesPanel';

type Overview = { categories: Category[]; docTemplates: DocTemplateSummary[] };

const TABS = [
    ['categories', '분류'],
    ['items', '품목 문구'],
    ['docs', '양식'],
    ['accounts', '계정과목'],
] as const;

// 업무 설정 — 분류·품목 문구·양식·계정과목 네 탭 (분류 목록은 여러 탭이 같이 씀)
export function SettingsPage() {
    const { state, reload, refresh } = useApiData<Overview>(SETTINGS_API, undefined, 'GET');
    const [tab, setTab] = useState<(typeof TABS)[number][0]>('categories');

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
            <h1 className="mb-4 text-2xl font-bold">업무 설정</h1>
            <div role="tablist" aria-label="설정 종류" className="mb-5 flex gap-2">
                {TABS.map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => setTab(key)}
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary ${
                            tab === key ? 'bg-primary text-white' : 'bg-surface text-muted hover:text-ink'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {/* 계정과목은 자기 API(/api/work/accounts)를 따로 불러옴 */}
            {tab === 'accounts' && (
                <div role="tabpanel">
                    <AccountsPanel />
                </div>
            )}
            {tab !== 'accounts' && state.status === 'loading' && <Skeleton className="h-64 w-full" />}
            {tab !== 'accounts' && state.status === 'error' && <ErrorState onRetry={reload} />}
            {tab !== 'accounts' && state.status === 'ok' && (
                <div role="tabpanel">
                    {tab === 'categories' && <CategoriesPanel categories={state.data.categories} refresh={refresh} />}
                    {tab === 'items' && <ItemTemplatesPanel categories={state.data.categories} />}
                    {tab === 'docs' && <DocTemplatesPanel categories={state.data.categories} docTemplates={state.data.docTemplates} refresh={refresh} />}
                </div>
            )}
        </main>
    );
}
