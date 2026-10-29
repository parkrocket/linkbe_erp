// 로그인 후 이동 경로 검증 — 같은 사이트 내부 경로만 허용 (오픈 리다이렉트 방지)
// 문자열 검사만으로는 '/\t/evil.com'처럼 URL 파서가 탭·줄바꿈을 제거해 '//evil.com'이 되는 우회를 못 막음
// → 브라우저와 같은 WHATWG URL 파서로 해석한 뒤 출처가 그대로인지 확인
const BASE = 'http://internal.invalid';

export function safeRedirect(target: string | null): string {
    if (!target || !target.startsWith('/')) return '/';
    try {
        const url = new URL(target, BASE);
        if (url.origin !== BASE) return '/';
        return url.pathname + url.search + url.hash;
    } catch {
        return '/';
    }
}
