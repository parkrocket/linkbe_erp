// 서버 컴포넌트 전용 — 현재 로그인 사용자 조회
// 토큰 검증은 API 서버가 하고, 여기서는 쿠키를 전달만 함 (JWT 비밀키는 API 서버에만)
import { cookies } from 'next/headers';
import { cache } from 'react';
import { apiFetch } from './api';
import type { User } from './types';

type AuthResponse = { isAuth: boolean; user?: User };

// cache: 같은 요청 안에서 헤더·페이지가 각각 불러도 API는 한 번만 호출
export const getCurrentUser = cache(async (): Promise<User | null> => {
    const token = (await cookies()).get('x_auth')?.value;
    if (!token) return null;

    try {
        // 기존 API 계약: /users/auth는 body의 x_auth로 검증
        const res = await apiFetch<AuthResponse>('/api/users/auth', {
            method: 'POST',
            body: { x_auth: token },
            cookie: `x_auth=${token}`,
        });
        return res.isAuth && res.user ? res.user : null;
    } catch {
        // API 장애 시 비로그인으로 취급 (페이지 전체 실패 방지)
        return null;
    }
});
