// 로컬 개발 전용: /api 요청만 API 서버(5000)로 전달 — 같은 출처라 로그인 쿠키가 함께 전송됨
// package.json "proxy"는 HMR 파일 요청까지 API로 넘겨 무한 새로고침을 유발해 사용하지 않음
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use(
        '/api',
        createProxyMiddleware({
            target: 'http://localhost:5000',
            changeOrigin: true,
        }),
    );
};
