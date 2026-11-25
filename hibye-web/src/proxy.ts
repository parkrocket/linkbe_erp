// 모든 화면: 차단 IP 검사(관리 '차단 IP') / 로그인 필요 경로: 쿠키 유무 확인 (Next 16: middleware → proxy)
// 쿠키 유무만 빠르게 확인 — 실제 토큰 검증은 API 서버가 하고, 만료 토큰은 API 401 → 로그인 이동으로 처리
import { NextResponse, type NextRequest } from 'next/server';

// 서버 컴포넌트가 지금 주소를 알 수 있게 전달 — 토큰 만료로 로그인에 보낼 때 원래 화면으로 돌아오게(lib/auth loginPath)
export const PATH_HEADER = 'x-hibye-path';

// 기존 react-app의 로그인 후 화면 경로 (/, /login, /register, /gtw 는 공개)
const PROTECTED = ['/vaca', '/geo', '/work', '/workHistory', '/sent', '/calendar', '/admin', '/mypage'];
const isProtected = (path: string) => PROTECTED.some(p => path === p || path.startsWith(`${p}/`));

// 차단 IP 목록 — API(서버 안 직접 요청만 허용)에서 30초마다 다시 받음. 못 받으면 직전 목록(처음이면 아무도 안 막음 — 사이트가 닫히지 않게)
const REFRESH_MS = 30 * 1000;
let blocked = new Set<string>();
let loadedAt = 0;
async function blockedIps(): Promise<Set<string>> {
    if (Date.now() - loadedAt < REFRESH_MS) return blocked;
    loadedAt = Date.now(); // 실패해도 30초는 다시 시도하지 않음(요청마다 API를 두드리지 않게)
    try {
        const res = await fetch(`${process.env.API_INTERNAL_URL ?? 'http://localhost:5000'}/api/internal/blocked-ips`, { cache: 'no-store', signal: AbortSignal.timeout(2000) });
        if (res.ok) blocked = new Set(((await res.json()) as { ips?: string[] }).ips ?? []);
    } catch {
        // 직전 목록 유지
    }
    return blocked;
}

// 방문자 IP — 운영은 nginx가 X-Real-IP에 실제 IP를 넣음(로드밸런서 뒤 real_ip). 없으면(로컬) 검사 안 함
const clientIp = (request: NextRequest) => (request.headers.get('x-real-ip') ?? '').trim().replace(/^::ffff:/, '').toLowerCase();

export async function proxy(request: NextRequest) {
    const ip = clientIp(request);
    if (ip && (await blockedIps()).has(ip)) {
        return new NextResponse('접근이 차단된 IP입니다. 관리자에게 문의해 주세요.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    const path = request.nextUrl.pathname;
    if (!isProtected(path)) return NextResponse.next();

    if (request.cookies.has('x_auth')) {
        const headers = new Headers(request.headers);
        headers.set(PATH_HEADER, path + request.nextUrl.search);
        return NextResponse.next({ request: { headers } });
    }

    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', path + request.nextUrl.search);
    return NextResponse.redirect(login);
}

// 정적 파일(_next/static·이미지·아이콘)만 빼고 모든 화면
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|jpg|svg|ico|webp|woff2?)$).*)'],
};
