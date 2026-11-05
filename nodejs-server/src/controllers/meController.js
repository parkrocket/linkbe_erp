const User = require('../models/userModel');
const { validateSelfProfile } = require('../utils/profileValidation');
const { PASSWORD_RULE } = require('../utils/registerValidation');
const { issueLoginCookie } = require('../utils/authCookie');
const rateLimit = require('../utils/rateLimit');
const { escapeSlack } = require('../utils/slackEscape');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

// 마이페이지 — 언제나 토큰 주인(req.userId)만. 요청 바디의 userId·mbNo는 받지 않음
// 비밀번호·해시는 로그·오류 메시지에 쓰지 않음(오류는 code만)
const MAX_PW_TRY = 5;
const PW_WINDOW_MS = 15 * 60 * 1000;

const fail = (res, code, error) => res.status(code).json({ error });
const same = (password, hash) => new Promise((resolve, reject) => User.comparePassword(password, hash, (err, ok) => (err ? reject(err) : resolve(ok))));

exports.get = async (req, res) => {
    try {
        const me = await User.findMe(req.userId);
        if (!me) return fail(res, 404, 'User not found');
        res.set('Cache-Control', 'no-store').json({ me });
    } catch (error) {
        console.error('me get error:', error.code || error.message);
        fail(res, 500, 'Database query error');
    }
};

// 이름·연락처·성별·생년월일만 — 입사일·부서·직급·고용형태는 관리자 화면에서
exports.updateProfile = async (req, res) => {
    const checked = validateSelfProfile(req.body);
    if (checked.error) return fail(res, 400, checked.error);
    try {
        const before = await User.findMe(req.userId);
        if (!before) return fail(res, 404, 'User not found');
        await User.updateSelfProfile(req.userId, checked.value);
        // 이름은 Slack 알림·캘린더 일정 제목에 쓰여 관리자에게 알림 (연락처·생년월일 등 값은 알림에 넣지 않음)
        if (before.user_name !== checked.value.name) {
            try {
                await slack.sendSlackMessage('#hibye-관리', `${escapeSlack(before.user_name)}님이 이름을 '${escapeSlack(checked.value.name)}'(으)로 바꿨어요`);
            } catch (error) {
                console.error('me rename slack error:', error.code || 'unknown');
            }
        }
        res.json({ me: await User.findMe(req.userId) });
    } catch (error) {
        console.error('me profile error:', error.code || error.message);
        fail(res, 500, 'Database query error');
    }
};

// 현재 비밀번호 확인 → 변경 → 다른 기기 로그아웃(변경 시각 이전 로그인 거절), 지금 기기는 같은 만료로 새 로그인
exports.changePassword = async (req, res) => {
    try {
        const limitKey = `mypw:${req.userId}`;
        // 시도 전에 먼저 셈 — 동시 요청으로 한도를 넘겨 비밀번호를 시험하지 못하게 (성공하면 clear)
        if (!rateLimit.hit(limitKey, MAX_PW_TRY, PW_WINDOW_MS)) return fail(res, 429, 'Too many attempts');
        const { current, next } = req.body || {};
        if (typeof current !== 'string' || current.length < 1 || current.length > 200) return fail(res, 400, 'Invalid password');
        if (typeof next !== 'string' || !PASSWORD_RULE.test(next)) return fail(res, 400, 'Invalid new password');
        if (next === current) return fail(res, 400, 'Same password');

        const hash = await User.findPasswordHash(req.userId);
        const ok = hash ? await same(current, hash).catch(() => false) : false; // bcrypt 오류는 틀림으로
        if (!ok) return fail(res, 403, 'Wrong password');

        const nowSec = Math.floor(Date.now() / 1000);
        await User.updatePassword(req.userId, next, nowSec);
        rateLimit.clear(limitKey);
        // 남은 기간 그대로(24시간·30일 중 처음 고른 것), 발급 시각 = 변경 시각 → 이 기기만 계속 로그인
        const remainingMs = Math.max(0, (Number(req.tokenExp) - nowSec) * 1000);
        if (remainingMs > 0) issueLoginCookie(res, req.userId, remainingMs, nowSec);
        res.json({ changed: true });
    } catch (error) {
        console.error('me password error:', error.code || 'unknown');
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};
