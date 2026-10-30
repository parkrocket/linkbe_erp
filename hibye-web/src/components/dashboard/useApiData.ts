'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError, hasFailedFlag } from '@/lib/api';

type State<T> = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: T };

// 대시보드 카드 공용 — 카드마다 로딩·에러를 따로 가져 한 카드 실패가 다른 카드에 번지지 않음
// method: 관리자 API 등 GET 조회는 'GET' (body 무시)
export function useApiData<T>(path: string, body: unknown, method: 'GET' | 'POST' = 'POST') {
    const router = useRouter();
    const [state, setState] = useState<State<T>>({ status: 'loading' });
    const bodyKey = JSON.stringify(body);

    // 요청 결과를 다음 상태로 변환만 함 (setState는 응답 콜백에서)
    const request = useCallback(async (): Promise<State<T> | null> => {
        try {
            const data = await apiFetch<T>(path, method === 'GET' ? { method } : { method, body: JSON.parse(bodyKey) });
            // 200이어도 xxxSuccess: false면 에러 화면 (정상 데이터처럼 보이지 않게)
            if (hasFailedFlag(data)) return { status: 'error' };
            return { status: 'ok', data };
        } catch (error) {
            // 토큰 만료 등 → 로그인으로 (런타임 에러로 남기지 않음)
            if (error instanceof ApiError && error.status === 401) {
                router.replace('/login?redirect=/');
                return null;
            }
            return { status: 'error' };
        }
    }, [path, bodyKey, method, router]);

    useEffect(() => {
        // 화면을 떠난 뒤 도착한 응답은 무시
        let active = true;
        request().then(next => {
            if (active && next) setState(next);
        });
        return () => {
            active = false;
        };
    }, [request]);

    // 다시 시도: 로딩 표시 후 재요청
    const reload = useCallback(() => {
        setState({ status: 'loading' });
        request().then(next => next && setState(next));
    }, [request]);

    return { state, reload };
}

// 브라우저 기준 오늘 날짜 'YYYY-MM-DD'
export function todayString(now = new Date()) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
