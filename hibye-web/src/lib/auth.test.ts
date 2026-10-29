import { afterEach, describe, expect, it, vi } from 'vitest';

// next/headers의 cookies()를 테스트용으로 대체
let token: string | undefined;
vi.mock('next/headers', () => ({
    cookies: async () => ({ get: () => (token ? { value: token } : undefined) }),
}));

const { getCurrentUser } = await import('./auth');

function stubFetch(impl: () => Promise<Response>) {
    vi.stubGlobal('fetch', vi.fn(impl));
}

describe('getCurrentUser', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        token = undefined;
    });

    it('쿠키가 없으면 API 호출 없이 null', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(getCurrentUser()).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('토큰이 유효하지 않으면(isAuth false) null — 소개 랜딩', async () => {
        token = 't';
        stubFetch(async () => new Response(JSON.stringify({ isAuth: false }), { status: 200 }));
        await expect(getCurrentUser()).resolves.toBeNull();
    });

    it('API 서버 장애(5xx)는 로그아웃으로 위장하지 않고 에러를 던진다', async () => {
        token = 't';
        stubFetch(async () => new Response('{}', { status: 502 }));
        await expect(getCurrentUser()).rejects.toThrow();
    });

    it('네트워크 오류도 에러를 던진다', async () => {
        token = 't';
        stubFetch(async () => {
            throw new TypeError('fetch failed');
        });
        await expect(getCurrentUser()).rejects.toThrow();
    });
});
