'use client';

import { useApiData } from '@/components/dashboard/useApiData';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { WorkSettingsTab } from '@/lib/adminNav';
import type { Category, DocTemplateSummary } from '@/lib/contract';
import { SETTINGS_API } from './settingsApi';
import { AccountsPanel } from './AccountsPanel';
import { CategoriesPanel } from './CategoriesPanel';
import { DocTemplatesPanel } from './DocTemplatesPanel';
import { ItemTemplatesPanel } from './ItemTemplatesPanel';

type Overview = { categories: Category[]; docTemplates: DocTemplateSummary[] };

// 업무 설정 — 관리 화면 /admin/work/<탭>에서 탭 하나씩 (11-05: 업무 메뉴 → 관리자 페이지로 옮김)
export function SettingsPanel({ tab }: { tab: WorkSettingsTab }) {
    // 계정과목은 자기 API(/api/work/accounts)를 따로 불러옴
    if (tab === 'accounts') return <AccountsPanel />;
    return <DocSettings tab={tab} />;
}

// 분류·품목 문구·양식 — 분류 목록을 같이 씀
function DocSettings({ tab }: { tab: Exclude<WorkSettingsTab, 'accounts'> }) {
    const { state, reload, refresh } = useApiData<Overview>(SETTINGS_API, undefined, 'GET');
    if (state.status === 'loading') return <Skeleton className="h-64 w-full" />;
    if (state.status === 'error') return <ErrorState onRetry={reload} />;
    const { categories, docTemplates } = state.data;
    if (tab === 'categories') return <CategoriesPanel categories={categories} refresh={refresh} />;
    if (tab === 'items') return <ItemTemplatesPanel categories={categories} />;
    return <DocTemplatesPanel categories={categories} docTemplates={docTemplates} refresh={refresh} />;
}
