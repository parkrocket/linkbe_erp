// 로그인 후 이동 경로 검증 — '/'로 시작하는 내부 경로만 허용
// '//host', '/\host'는 브라우저가 외부 주소로 해석하므로 차단(오픈 리다이렉트 방지)
export function safeRedirect(target: string | null): string {
    if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
        return '/';
    }
    return target;
}
