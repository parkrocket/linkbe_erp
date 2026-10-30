// 로그인 필요 경로 접근 검사 (Next 16: middleware → proxy)
// 쿠키 유무만 빠르게 확인 — 실제 토큰 검증은 API 서버가 하고, 만료 토큰은 API 401 → 로그인 이동으로 처리
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    if (request.cookies.has('x_auth')) return NextResponse.next();

    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
}

// 기존 react-app의 로그인 후 화면 경로 (/, /login, /register, /gtw 는 공개)
export const config = {
    matcher: ['/vaca/:path*', '/geo/:path*', '/work/:path*', '/workHistory/:path*', '/sent/:path*', '/calendar/:path*', '/admin/:path*'],
};
