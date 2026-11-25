const BlockedIp = require('../models/blockedIpModel');
const Admin = require('../models/adminModel');
const { normalizeIp, protectedIps, invalidate } = require('../utils/ipBlock');
const { escapeSlack } = require('../utils/slackEscape');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

// 관리: hibye.kr 접속 차단 IP — 목록·추가·해제 (requireAdmin 뒤)
const REASON_MAX = 200;
const fail = (res, code, error) => res.status(code).json({ error });

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('blocked ip api error:', error.message);
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};

// #hibye-관리 기록 — 실패해도 조치는 그대로
async function notify(req, text) {
    try {
        const actor = await Admin.findByUserId(req.userCpId, req.userId);
        await slack.sendSlackMessage('#hibye-관리', `${escapeSlack(actor ? actor.user_name : req.userId)}님이 ${text}`);
    } catch (e) {
        console.error('blocked ip slack notice failed:', e.message);
    }
}

exports.list = handle(async (req, res) => {
    const rows = await BlockedIp.list(req.userCpId);
    res.set('Cache-Control', 'no-store').json({
        items: rows.map(r => ({
            id: r.id, ip: r.ip, reason: r.reason, mbNo: r.mb_no, targetName: r.target_name, creatorName: r.creator_name || r.created_by, createdAt: r.created_at,
        })),
        myIp: normalizeIp(req.ip), // 화면 안내용(자기 IP는 차단 불가)
    });
});

// 추가 — { ip, reason, mbNo? }. 사무실·서버·지금 내 IP는 거절(회사 전체·관리자 본인이 잠기지 않게)
exports.add = handle(async (req, res) => {
    const ip = normalizeIp(req.body?.ip);
    if (!ip) return fail(res, 400, 'Invalid ip');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length > REASON_MAX) return fail(res, 400, 'Invalid reason');
    if (protectedIps().has(ip) || ip === normalizeIp(req.ip)) return fail(res, 409, 'Protected ip');

    // 직원 목록에서 누른 경우 — 같은 회사 직원이고 그 직원의 마지막 접속 IP여야 함(화면과 DB가 어긋나지 않게)
    let target = null;
    if (req.body?.mbNo != null) {
        const mbNo = Number(req.body.mbNo);
        target = Number.isInteger(mbNo) && mbNo > 0 ? await Admin.findByMbNo(req.userCpId, mbNo) : null;
        if (!target) return fail(res, 404, 'User not found');
        if (target.user_id === req.userId) return fail(res, 409, 'Cannot change yourself');
        if (normalizeIp(target.last_login_ip) !== ip) return fail(res, 409, 'Ip changed');
    }

    try {
        await BlockedIp.add(req.userCpId, { ip, reason, mbNo: target ? target.mb_no : null, createdBy: req.userId });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Already blocked');
        throw e;
    }
    await invalidate();
    await notify(req, `IP ${ip}${target ? ` (${escapeSlack(target.user_name)}님 마지막 접속)` : ''}를 hibye.kr 접속 차단했어요${reason ? ` — ${escapeSlack(reason)}` : ''}`);
    res.json({ ok: true });
});

exports.remove = handle(async (req, res) => {
    const id = Number(req.params.id);
    const row = Number.isInteger(id) && id > 0 ? await BlockedIp.find(req.userCpId, id) : null;
    if (!row) return fail(res, 404, 'Not found');
    await BlockedIp.remove(req.userCpId, id);
    await invalidate();
    await notify(req, `IP ${row.ip} 차단을 해제했어요`);
    res.json({ ok: true });
});
