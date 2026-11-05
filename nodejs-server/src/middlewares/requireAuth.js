const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { clearLoginCookie, isRevoked } = require('../utils/authCookie');

// 로그인 없이 호출 가능한 API (경로는 /api 기준)
// - users: 로그인·가입·인증확인·로그아웃
// - company/list: 회원가입 화면의 회사 목록
// - slack: Slack 서버 호출(서명 검증으로 보호)
const PUBLIC_PATHS = [
    '/users/login',
    '/users/register',
    '/users/auth',
    '/users/logout',
    '/company/list',
    '/test', // 배포 후 헬스체크
];
const PUBLIC_PREFIXES = ['/slack/', '/public/']; // /public/: 회사 홈페이지 공개 API(읽기·문의 접수)

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
            clearLoginCookie(res); // 만료·위조 쿠키도 지움
            return res.status(401).json({ isAuth: false, error: 'Invalid token' });
        }
        // 매 요청 계정 상태 확인 — 비활성화·거절되면 토큰 만료(24시간·30일)를 기다리지 않고 다음 요청부터 차단
        let account;
        try {
            account = await User.findStatusById(decoded.userId);
        } catch (e) {
            console.error('requireAuth status lookup failed:', e.message);
            return res.status(500).json({ isAuth: false, error: 'Database query error' });
        }
        // 비활성·거절·없는 계정, 비밀번호 변경 전에 발급된 로그인(다른 기기) → 401 + 쿠키 삭제(그 브라우저는 완전히 로그아웃)
        if (!account || account.user_status !== 'approved') {
            clearLoginCookie(res);
            return res.status(401).json({ isAuth: false, error: 'Account not active' });
        }
        if (isRevoked(decoded.iat, account.pw_changed_sec)) {
            clearLoginCookie(res);
            return res.status(401).json({ isAuth: false, error: 'Session expired' });
        }
        req.tokenExp = decoded.exp; // 비밀번호 변경 후 지금 기기의 새 로그인을 같은 만료로 발급할 때 사용
        req.userId = decoded.userId;
        req.userRole = account.user_role;
        req.userCpId = account.cp_id;
        req.userHomepage = Number(account.homepage_access) === 1; // 홈페이지 관리 권한 (requireHomepage)
        // 업무 문서·경비 승인 권한 — 관리자는 둘 다 가짐
        const isAdmin = account.user_role === 'admin';
        req.workDoc = isAdmin || Number(account.work_doc_access) === 1;
        req.expenseApprover = isAdmin || Number(account.expense_approver) === 1;
        req.clientSecret = isAdmin || Number(account.client_secret_access) === 1; // 거래처 접속정보 권한 (requireClientSecret)
        next();
    });
}

module.exports = { requireAuth, readTokenFromCookie };
