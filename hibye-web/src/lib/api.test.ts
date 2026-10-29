import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from './api';

// fetch 호출을 기록하고 지정한 응답을 돌려주는 가짜
function stubFetch(status: number, body: unknown) {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit) => {
            calls.push({ url, init });
            return new Response(JSON.stringify(body), { status });
        }),
    );
    return calls;
}

describe('apiFetch (서버 환경)', () => {
    beforeEach(() => {
        vi.stubEnv('API_INTERNAL_URL', 'http://internal:5000');
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('200 응답의 JSON을 돌려주고 내부 주소로 호출한다', async () => {
        const calls = stubFetch(200, { a: 1 });
        await expect(apiFetch('/api/x')).resolves.toEqual({ a: 1 });
        expect(calls[0].url).toBe('http://internal:5000/api/x');
    });

    it('401이면 status 401인 ApiError를 던진다', async () => {
        stubFetch(401, { isAuth: false });
        const err = (await apiFetch('/api/x').catch(e => e)) as ApiError;
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(401);
    });

    it('500이면 status 500인 ApiError를 던진다', async () => {
        stubFetch(500, {});
        const err = (await apiFetch('/api/x').catch(e => e)) as ApiError;
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(500);
    });

    it('cookie 옵션을 요청 헤더로 전달한다', async () => {
        const calls = stubFetch(200, {});
        await apiFetch('/api/x', { cookie: 'x_auth=t' });
        expect(new Headers(calls[0].init.headers).get('cookie')).toBe('x_auth=t');
    });

    it('body 객체를 JSON으로 보낸다', async () => {
        const calls = stubFetch(200, {});
        await apiFetch('/api/x', { method: 'POST', body: { userId: 'u' } });
        expect(calls[0].init.body).toBe('{"userId":"u"}');
        expect(new Headers(calls[0].init.headers).get('content-type')).toBe('application/json');
    });
});

describe('apiFetch (브라우저 환경)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('같은 출처 /node 경로로 호출한다', async () => {
        vi.stubGlobal('window', {});
        const calls = stubFetch(200, {});
        await apiFetch('/api/x');
        expect(calls[0].url).toBe('/node/api/x');
    });
});
