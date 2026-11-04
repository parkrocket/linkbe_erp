const User = require('../models/userModel');
const Admin = require('../models/adminModel');
const { CredentialLog } = require('../models/clientModel');
const box = require('../utils/secretBox');
const rateLimit = require('../utils/rateLimit');
const { escapeSlack } = require('../utils/slackEscape');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

// 거래처 접속정보 암호화 키 확인(백업용) — 관리자 + 비밀번호 재확인, 키는 DB에 없고 환경변수에서만 읽음
// 비밀번호·키·해시는 로그·오류 메시지에 쓰지 않음(오류는 code만)
const MAX_FAIL = 5;
const WINDOW_MS = 15 * 60 * 1000;

const fail = (res, code, error) => res.status(code).json({ error });
const same = (password, hash) => new Promise((resolve, reject) => User.comparePassword(password, hash, (err, ok) => (err ? reject(err) : resolve(ok))));

exports.reveal = async (req, res) => {
    try {
        const limitKey = `keyview:${req.userId}`;
        if (rateLimit.isBlocked(limitKey, MAX_FAIL, WINDOW_MS)) return fail(res, 429, 'Too many attempts');
        const { password } = req.body || {};
        if (typeof password !== 'string' || password.length < 1 || password.length > 200) return fail(res, 400, 'Invalid password');

        const hash = await Admin.findPasswordHash(req.userCpId, req.userId);
        if (!hash || !(await same(password, hash))) {
            rateLimit.hit(limitKey, MAX_FAIL, WINDOW_MS);
            return fail(res, 403, 'Wrong password');
        }
        const key = box.readKeyString();
        if (!key) return fail(res, 503, 'Secret key missing');

        const actorRow = await Admin.findByUserId(req.userCpId, req.userId);
        if (!actorRow) return fail(res, 401, 'Unauthorized');
        const actor = { no: actorRow.mb_no, name: String(actorRow.user_name || '').slice(0, 50) };
        // 기록 먼저 — 실패하면 키를 주지 않음
        await CredentialLog.insert(null, { cpId: req.userCpId, clientId: 0, credentialId: null, target: 'key', action: 'view', actor });
        try {
            await slack.sendSlackMessage('#hibye-관리', `${escapeSlack(actor.name)}님이 거래처 접속정보 암호화 키를 확인했어요`);
        } catch (error) {
            console.error('secret key view slack error:', error.code || 'unknown');
        }
        rateLimit.clear(limitKey);
        res.set('Cache-Control', 'no-store').json({ key });
    } catch (error) {
        console.error('secret key view error:', error.code || 'unknown');
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};
