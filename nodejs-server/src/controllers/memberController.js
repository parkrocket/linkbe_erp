const bcrypt = require('bcrypt');
const Member = require('../models/memberModel');
const { hashPassword, verifyPassword } = require('../utils/memberPassword');
const { validateRegister, validateProfile, validateNewPassword } = require('../utils/memberValidation');
const rateLimit = require('../utils/rateLimit');
const { escapeSlack } = require('../utils/slackEscape');
const { memberCookieOptions, issueMemberCookie, secretOf, COOKIE } = require('../middlewares/requireMember');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

// 고객 회원 API(/api/public/shop/members/*) — 직원 로그인과 분리
const MIN_FILL_MS = 3000; // 이보다 빨리 제출하면 봇으로 봄
const HOUR = 60 * 60 * 1000;
const LOGIN_WINDOW = 15 * 60 * 1000;
const LOGIN_MAX = 5;
// 없는 아이디도 bcrypt 비교 1회를 하도록(응답 시간으로 계정 존재를 알 수 없게)
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('member api error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    }
};

const notify = async text => {
    try {
        await slack.sendSlackMessage(process.env.SLACK_SHOP_CHANNEL || '#결제', text);
    } catch (error) {
        console.error('member slack notice failed:', error.message);
    }
};

const brief = row => ({ id: row.id, loginId: row.login_id, name: row.name });

// ER_DUP_ENTRY → 어떤 칸이 겹쳤는지(메시지의 키 이름으로)
const dupError = error => {
    if (error.code !== 'ER_DUP_ENTRY') return null;
    if (/login_id/.test(error.message)) return 'Login id taken';
    if (/email/.test(error.message)) return 'Email taken';
    return null;
};

exports.register = handle(async (req, res) => {
    const body = req.body ?? {};
    const startedAt = Number(body.startedAt);
    const tooFast = !body.startedAt || !Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS;
    if (body.website || tooFast) return res.json({ ok: true }); // 봇에겐 성공처럼, 저장 안 함
    if (!rateLimit.hit(`register:${req.ip}`, 5, HOUR)) return res.status(429).json({ error: 'Too many requests' });

    const checked = validateRegister(body);
    if (checked.error) return res.status(400).json({ error: checked.error });
    secretOf(); // 쿠키를 못 만들면 가입 전에 실패
    const v = checked.value;
    let id;
    try {
        id = await Member.create({ loginId: v.loginId, passwordHash: await hashPassword(v.password), name: v.name, email: v.email, phone: v.phone });
    } catch (error) {
        const taken = dupError(error);
        if (taken) return res.status(409).json({ error: taken });
        throw error;
    }
    issueMemberCookie(res, id);
    res.json({ ok: true, member: { id, loginId: v.loginId, name: v.name } });
    await notify(`[회원가입] ${escapeSlack(v.name)}님`);
});

exports.login = handle(async (req, res) => {
    const loginId = typeof req.body?.loginId === 'string' ? req.body.loginId.trim() : '';
    const password = req.body?.password;
    const key = `login:${req.ip}|${loginId.toLowerCase()}`;
    if (rateLimit.isBlocked(key, LOGIN_MAX, LOGIN_WINDOW)) return res.status(429).json({ error: 'Too many attempts' });
    secretOf();

    const row = loginId ? await Member.findByLoginId(loginId) : undefined;
    const result = await verifyPassword(password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !result.ok) {
        rateLimit.hit(key, LOGIN_MAX, LOGIN_WINDOW);
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    rateLimit.clear(key);
    await Member.markLogin(row.id, result.needsRehash ? await hashPassword(password) : null);
    issueMemberCookie(res, row.id);
    res.json({ ok: true, member: brief(row) });
});

exports.logout = (req, res) => {
    res.clearCookie(COOKIE, memberCookieOptions());
    res.json({ ok: true });
};

exports.me = (req, res) => {
    const m = req.member;
    res.json({ member: { ...brief(m), email: m.email, phone: m.phone, createdAt: m.created_at } });
};

exports.updateMe = handle(async (req, res) => {
    const checked = validateProfile(req.body);
    if (checked.error) return res.status(400).json({ error: checked.error });
    try {
        await Member.updateProfile(req.member.id, checked.value);
    } catch (error) {
        if (dupError(error) === 'Email taken') return res.status(409).json({ error: 'Email taken' });
        throw error;
    }
    res.json({ ok: true });
});

// 현재 비밀번호 확인 (예전 형식 해시도 허용)
const passwordMatches = async (memberId, plain) => {
    const stored = await Member.findPasswordHash(memberId);
    return stored ? (await verifyPassword(plain, stored)).ok : false;
};

exports.changePassword = handle(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    const error = validateNewPassword(newPassword);
    if (error) return res.status(400).json({ error });
    if (!(await passwordMatches(req.member.id, currentPassword))) return res.status(400).json({ error: 'Wrong password' });
    await Member.updatePassword(req.member.id, await hashPassword(newPassword));
    issueMemberCookie(res, req.member.id); // 기존 쿠키는 password_changed_at 때문에 무효 — 지금 기기는 새로 발급
    res.json({ ok: true });
});

exports.leave = handle(async (req, res) => {
    if (!(await passwordMatches(req.member.id, req.body?.password))) return res.status(400).json({ error: 'Wrong password' });
    await Member.leave(req.member.id);
    res.clearCookie(COOKIE, memberCookieOptions());
    res.json({ ok: true });
    await notify(`[회원탈퇴] ${escapeSlack(req.member.name)}님`);
});
