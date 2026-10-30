const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// 로그인 없이 호출 가능한 API (경로는 /api 기준)
// - users: 로그인·가입·인증확인·로그아웃
// - company/list: 회원가입 화면의 회사 목록
// - slack: Slack 서버 호출(서명 검증으로 보호) 및 암호화 링크(gtwCheck)
const PUBLIC_PATHS = [
    '/users/login',
    '/users/register',
    '/users/auth',
    '/users/logout',
    '/company/list',
    '/test', // 배포 후 헬스체크
];
const PUBLIC_PREFIXES = ['/slack/'];

// 쿠키 헤더에서 x_auth만 꺼냄 (cookie-parser 의존성 없이)
function readTokenFromCookie(cookieHeader = '') {
    const found = cookieHeader
        .split(';')
        .map(part => part.trim())
        .find(part => part.startsWith('x_auth='));
    return found ? decodeURIComponent(found.slice('x_auth='.length)) : null;
}

// /api 하위 모든 요청에 JWT 검증 — 통과 시 req.userId에 토큰 주인 설정
function requireAuth(req, res, next) {
    if (
        PUBLIC_PATHS.includes(req.path) ||
        PUBLIC_PREFIXES.some(prefix => req.path.startsWith(prefix))
    ) {
        return next();
    }

    const token = readTokenFromCookie(req.headers.cookie);
    if (!token) {
        return res.status(401).json({ isAuth: false, error: 'Login required' });
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decoded) => {
        if (err) {
            return res.status(401).json({ isAuth: false, error: 'Invalid token' });
        }
        // 매 요청 계정 상태 확인 — 비활성화·거절되면 토큰 만료(24h)를 기다리지 않고 다음 요청부터 차단
        let account;
        try {
            account = await User.findStatusById(decoded.userId);
        } catch (e) {
            console.error('requireAuth status lookup failed:', e.message);
            return res.status(500).json({ isAuth: false, error: 'Database query error' });
        }
        if (!account || account.user_status !== 'approved') {
            return res.status(401).json({ isAuth: false, error: 'Account not active' });
        }
        req.userId = decoded.userId;
        req.userRole = account.user_role;
        req.userCpId = account.cp_id;
        next();
    });
}

module.exports = { requireAuth, readTokenFromCookie };
