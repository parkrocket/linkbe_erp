const jwt = require('jsonwebtoken');

// 직원 로그인 쿠키(x_auth) 발급·삭제 — 로그인·비밀번호 변경·비활성 계정 차단이 같은 속성을 쓰도록 한 곳에서
// 화면 코드가 읽지 못하게(httpOnly), 운영은 HTTPS 전용, 다른 사이트 요청엔 안 실림(lax).
// 지울 때도 같은 속성이어야 브라우저가 같은 쿠키로 인식
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 기본 24시간
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // '로그인 상태 유지' 30일

const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });

// iatSec: 발급 시각(초) — 비밀번호 변경 시각과 맞추려고 직접 지정 가능. 쿠키와 JWT 만료를 같은 값으로
const issueLoginCookie = (res, userId, ttlMs, iatSec = Math.floor(Date.now() / 1000)) => {
    const token = jwt.sign({ userId, iat: iatSec }, process.env.JWT_SECRET_KEY, { expiresIn: Math.floor(ttlMs / 1000) });
    res.cookie('x_auth', token, { ...cookieOptions(), maxAge: ttlMs });
};

const clearLoginCookie = res => res.clearCookie('x_auth', cookieOptions());

// 비밀번호 변경 시각(초, DB UNIX_TIMESTAMP) 전에 발급된 로그인인지 — 같은 초에 발급된 새 로그인은 유효
const isRevoked = (iatSec, pwChangedSec) => pwChangedSec != null && Number(iatSec) < Number(pwChangedSec);

module.exports = { TOKEN_TTL_MS, REMEMBER_TTL_MS, cookieOptions, issueLoginCookie, clearLoginCookie, isRevoked };
