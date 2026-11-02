const Member = require('../models/memberModel');
const { escapeSlack } = require('../utils/slackEscape');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

// 쇼핑(고객 회원) 관리자 API — requireAuth + requireHomepage 뒤에서만
const positiveInt = v => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

const handle = fn => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        console.error('admin shop api error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    }
};

exports.listMembers = handle(async (req, res) => {
    const page = positiveInt(req.query.page) || 1;
    const size = Math.min(positiveInt(req.query.size) || 20, 50);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const { rows, total } = await Member.listForAdmin({ q, page, size });
    res.json({
        members: rows.map(r => ({
            id: r.id,
            loginId: r.login_id,
            name: r.name,
            email: r.email,
            status: r.status,
            createdAt: r.created_at,
            lastLoginAt: r.last_login_at,
            orderCount: Number(r.order_count),
        })),
        total,
        page,
        size,
    });
});

exports.leaveMember = handle(async (req, res) => {
    const id = positiveInt(req.params.id);
    const member = id && (await Member.findById(id));
    if (!member || member.status !== 'active' || !(await Member.leave(id))) return res.status(404).json({ error: 'Member not found' });
    res.json({ ok: true });
    try {
        await slack.sendSlackMessage(process.env.SLACK_SHOP_CHANNEL || '#결제', `[회원탈퇴] 관리자 처리: ${escapeSlack(member.name)}님 (처리: 직원 #${req.userId})`);
    } catch (error) {
        console.error('admin shop slack notice failed:', error.message);
    }
});
