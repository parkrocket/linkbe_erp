// 로그인 필요 경로 접근 검사 (Next 16: middleware → proxy)
// 쿠키 유무만 빠르게 확인 — 실제 토큰 검증은 API 서버가 하고, 만료 토큰은 API 401 → 로그인 이동으로 처리
import { NextResponse, type NextRequest } from 'next/server';

// 서버 컴포넌트가 지금 주소를 알 수 있게 전달 — 토큰 만료로 로그인에 보낼 때 원래 화면으로 돌아오게(lib/auth loginPath)
export const PATH_HEADER = 'x-hibye-path';

export function proxy(request: NextRequest) {
    if (request.cookies.has('x_auth')) {
        const headers = new Headers(request.headers);
        headers.set(PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
        return NextResponse.next({ request: { headers } });
    }

    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
}

// 기존 react-app의 로그인 후 화면 경로 (/, /login, /register, /gtw 는 공개)
export const config = {
    matcher: ['/vaca/:path*', '/geo/:path*', '/work/:path*', '/workHistory/:path*', '/sent/:path*', '/calendar/:path*', '/admin/:path*'],
};
