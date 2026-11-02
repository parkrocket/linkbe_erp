const jwt = require('jsonwebtoken');
const Member = require('../models/memberModel');

// 고객 회원 로그인 — 직원(x_auth, JWT_SECRET_KEY)과 쿠키 이름·비밀키 모두 분리
const COOKIE = 'lb_member';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 비밀키가 비어 있으면 던짐(호출부 handle()이 500) — 빈 키로 서명·검증하지 않기 위해
const secretOf = () => {
    const secret = process.env.MEMBER_JWT_SECRET;
    if (!secret) throw new Error('MEMBER_JWT_SECRET not set');
    return secret;
};

const memberCookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });

const issueMemberCookie = (res, memberId) => {
    const token = jwt.sign({ mid: memberId }, secretOf(), { expiresIn: '7d' });
    res.cookie(COOKIE, token, { ...memberCookieOptions(), maxAge: TTL_MS });
};

const readCookie = (header = '') => {
    const found = header
        .split(';')
        .map(part => part.trim())
        .find(part => part.startsWith(`${COOKIE}=`));
    if (!found) return null;
    try {
        return decodeURIComponent(found.slice(COOKIE.length + 1));
    } catch {
        return null; // 깨진 퍼센트 인코딩 -> 로그인 안 한 것으로
    }
};

// 토큰 검증 → 탈퇴·비활성·비밀번호 변경 전 토큰이면 401. 시각 비교는 DB 안에서(findForSession)
const requireMember = async (req, res, next) => {
    const deny = () => res.status(401).json({ error: 'Login required' });
    try {
        const token = readCookie(req.headers.cookie);
        if (!token || !process.env.MEMBER_JWT_SECRET) return deny();
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.MEMBER_JWT_SECRET, { algorithms: ['HS256'] });
        } catch {
            return deny();
        }
        if (!Number.isInteger(decoded.mid) || !Number.isFinite(decoded.iat)) return deny();
        const row = await Member.findForSession(decoded.mid, decoded.iat);
        if (!row || Number(row.token_stale) === 1) return deny();
        req.member = row;
        next();
    } catch (error) {
        console.error('requireMember error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { requireMember, memberCookieOptions, issueMemberCookie, secretOf, COOKIE };
