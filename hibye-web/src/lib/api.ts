// nodejs-server 호출 공통 함수 — 주소 결정·JSON 처리·에러 변환을 한 곳에서

export class ApiError extends Error {
    constructor(public status: number) {
        super(`API ${status}`);
        this.name = 'ApiError';
    }
}

type Options = {
    method?: 'GET' | 'POST';
    body?: unknown;
    // 서버 컴포넌트에서 브라우저 쿠키를 API로 전달할 때 사용
    cookie?: string;
};

// path는 '/api/...' 형식
export async function apiFetch<T>(path: string, { method = 'GET', body, cookie }: Options = {}): Promise<T> {
    // 브라우저: 같은 출처 /node 경로(쿠키 자동 전송) / 서버: 내부 주소로 직접
    // 미설정 시 로컬 개발 기본값 (next.config.ts rewrites와 동일)
    const base = typeof window === 'undefined' ? (process.env.API_INTERNAL_URL ?? 'http://localhost:5000') : '/node';

    const headers = new Headers();
    if (body !== undefined) headers.set('content-type', 'application/json');
    if (cookie) headers.set('cookie', cookie);

    const res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
    });

    if (!res.ok) throw new ApiError(res.status);
    return res.json() as Promise<T>;
}

// 기존 API는 DB 오류도 HTTP 200 + { xxxSuccess: false }로 응답 → 화면 데이터 조회에서는 실패로 취급
// (로그인처럼 실패가 정상 흐름인 호출에는 쓰지 않음)
export function hasFailedFlag(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    return Object.entries(data).some(([key, value]) => key.endsWith('Success') && value === false);
}
