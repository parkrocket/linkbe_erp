const Admin = require('../models/adminModel');
const Balance = require('../models/balanceModel');
const BalanceLog = require('../models/balanceLog');
const { validateAdjust } = require('../utils/balanceValidation');
const { escapeSlack } = require('../utils/slackEscape');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

// 관리자 API — requireAuth(승인·상태 확인) + requireAdmin 뒤에서만 호출됨
// 대상은 항상 요청자와 같은 회사(req.userCpId)

const STATUSES = ['pending', 'approved', 'rejected', 'inactive'];
const ROLES = ['member', 'admin'];

// 허용되는 상태 전이 (스펙 5장)
const TRANSITIONS = {
    pending: ['approved', 'rejected'],
    approved: ['inactive'],
    inactive: ['approved'],
    rejected: ['approved'],
};

// Slack 기록 문구용 동작 이름
const STATUS_ACTION = { approved: '승인', rejected: '거절', inactive: '비활성화' };
const ROLE_ACTION = { admin: '관리자로 지정', member: '관리자 해제' };

const fail = (res, code, error) => res.status(code).json({ error });

// URL의 직원 번호 — 양의 정수가 아니면 null
const parseMbNo = value => {
    const mbNo = Number(value);
    return Number.isInteger(mbNo) && mbNo > 0 ? mbNo : null;
};

// 대상 조회 + 공통 검사(번호 형식, 같은 회사, 자기 자신)
async function loadTarget(req, res) {
    const mbNo = parseMbNo(req.params.mbNo);
    if (!mbNo) return fail(res, 404, 'User not found') && null;
    const target = await Admin.findByMbNo(req.userCpId, mbNo);
    if (!target) return fail(res, 404, 'User not found') && null;
    if (target.user_id === req.userId) return fail(res, 409, 'Cannot change yourself') && null;
    return target;
}

// 이 변경으로 '승인된 관리자'가 0명이 되는지
async function removesLastAdmin(cpId, target) {
    const isApprovedAdmin = target.user_role === 'admin' && target.user_status === 'approved';
    return isApprovedAdmin && (await Admin.countApprovedAdmins(cpId)) <= 1;
}

async function record(req, target, action) {
    const actor = await Admin.findByUserId(req.userCpId, req.userId);
    const actorName = actor ? actor.user_name : req.userId;
    await slack.sendSlackMessage('#hibye-관리', `${escapeSlack(actorName)}님이 ${escapeSlack(target.user_name)}님을 ${action}했어요`);
}

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        // 모델의 상태 코드 오류(BalanceError)는 그대로, 나머지는 500
        if (error.status) return fail(res, error.status, error.message);
        console.error('admin api error:', error.message);
        if (!res.headersSent) fail(res, 500, 'Database query error');
    }
};

exports.listUsers = handle(async (req, res) => {
    const { status } = req.query;
    if (status && !STATUSES.includes(status)) return fail(res, 400, 'Invalid status');
    res.json({ users: await Admin.listUsers(req.userCpId, status) });
});

exports.summary = handle(async (req, res) => {
    res.json({ pendingCount: await Admin.pendingCount(req.userCpId) });
});

exports.changeStatus = handle(async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    const { status } = req.body;
    if (!(TRANSITIONS[target.user_status] || []).includes(status)) return fail(res, 400, 'Invalid transition');
    if (status !== 'approved' && (await removesLastAdmin(req.userCpId, target))) return fail(res, 409, 'Last admin');

    await Admin.updateStatus(target.mb_no, status);
    // inactive/rejected → approved는 '다시 활성화', pending → approved는 '승인'
    const action = status === 'approved' && target.user_status !== 'pending' ? '다시 활성화' : STATUS_ACTION[status];
    await record(req, target, action);
    res.json({ ok: true });
});

exports.changeRole = handle(async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    const { role } = req.body;
    if (!ROLES.includes(role)) return fail(res, 400, 'Invalid role');
    if (role === target.user_role) return res.json({ ok: true }); // 변경 없음
    if (role === 'member' && (await removesLastAdmin(req.userCpId, target))) return fail(res, 409, 'Last admin');

    await Admin.updateRole(target.mb_no, role);
    await record(req, target, ROLE_ACTION[role]);
    res.json({ ok: true });
});

// ── 연차·휴가 조정 (관리자 2단계) ──
exports.listBalances = handle(async (req, res) => {
    res.json({ users: await Balance.listApproved(req.userCpId) });
});

exports.adjustBalances = handle(async (req, res) => {
    const input = validateAdjust(req.body);
    if (input.error) return fail(res, 400, input.error);

    const actor = await Admin.findByUserId(req.userCpId, req.userId);
    const { changed } = await Balance.adjust({ cpId: req.userCpId, actorMbNo: actor.mb_no, ...input });

    // 기록은 커밋 후 — Slack 실패가 이미 저장된 조정을 실패처럼 보이게 하지 않도록
    try {
        await slack.sendSlackMessage(
            '#hibye-관리',
            `${escapeSlack(actor.user_name)}님이 연차·휴가를 조정했어요 (${changed}명) — 사유: ${escapeSlack(input.reason)}`,
        );
    } catch (error) {
        console.error('balance slack notice failed:', error.message);
    }
    res.json({ ok: true, changed });
});

exports.balanceLogs = handle(async (req, res) => {
    const mbNo = parseMbNo(req.params.mbNo);
    if (!mbNo || !(await Balance.exists(req.userCpId, mbNo))) return fail(res, 404, 'User not found');
    res.json({ logs: await BalanceLog.listByMember(req.userCpId, mbNo) });
});
