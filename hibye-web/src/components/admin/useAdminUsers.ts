'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApiData } from '@/components/dashboard/useApiData';
import { adminErrorMessage } from '@/lib/authMessages';
import type { AdminUser } from './adminApi';

export type RunAction = (action: () => Promise<unknown>, doneText: string) => Promise<void>;
export type AdminNotice = { tone: 'ok' | 'error'; text: string } | null;

// 가입 승인·직원 관리 공용 — 직원 목록 + 버튼 처리(실행 → 결과 안내 → 목록·메뉴 배지 갱신)
export function useAdminUsers() {
    const router = useRouter();
    const { state, reload, refresh } = useApiData<{ users?: AdminUser[] }>('/api/admin/users', undefined, 'GET');
    const [notice, setNotice] = useState<AdminNotice>(null);
    const users = state.status === 'ok' ? (state.data.users ?? []) : [];

    const run: RunAction = async (action, doneText) => {
        setNotice(null);
        try {
            await action();
            setNotice({ tone: 'ok', text: doneText });
            reload();
            router.refresh(); // 사이드 메뉴·헤더 배지(서버에서 셈)
        } catch (error) {
            setNotice({ tone: 'error', text: adminErrorMessage(error) });
        }
    };

    return { state, users, reload, refresh, run, notice };
}
