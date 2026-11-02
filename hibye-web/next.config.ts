import type { NextConfig } from 'next';

// 서버 → API 내부 주소. 운영은 pm2 환경변수로 127.0.0.1:5000 지정
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:5000';

const nextConfig: NextConfig = {
    cacheComponents: true,
    partialPrefetching: true,
    // 운영 서버에는 빌드 결과만 올려 pm2로 실행
    output: 'standalone',
    // 상위 폴더(hibye/)에도 package-lock.json이 있어 루트를 잘못 추정 → 이 앱 폴더로 고정
    outputFileTracingRoot: process.cwd(),
    turbopack: {
        root: process.cwd(),
        rules: {
            '*.css': {
                loaders: ['@tailwindcss/turbopack'],
                as: '*.css',
            },
        },
    },
    // 브라우저는 항상 같은 출처 /node/api/* 호출 → 로그인 쿠키 자동 전송
    // 운영은 nginx가 /node/를 먼저 처리하므로 이 규칙은 로컬 개발에서만 쓰임
    // 기존 앱에만 있던 화면(출퇴근 기록 등, 미사용) → 홈. 예전 Slack 메시지의 출근 링크 포함 (2026-11-02 전환)
    async redirects() {
        return ['/gtw', '/geo', '/work', '/workHistory', '/sent'].map(source => ({ source, destination: '/', permanent: false }));
    },
    async rewrites() {
        return [{ source: '/node/:path*', destination: `${API_INTERNAL_URL}/:path*` }];
    },
};

export default nextConfig;
