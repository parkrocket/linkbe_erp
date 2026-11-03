// 업무 문서·경비 승인 권한 점검: node scripts/checkWorkAuth.js  (DB·Slack 가짜 — 실제 호출 없음)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
process.env.JWT_SECRET_KEY = 'check-work-auth-secret';
const assert = require('assert');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/dbPromise');

// ── SQL 확인용 pool 가짜 ──
let lastSql = '';
pool.query = async sql => ((lastSql = sql), [[{}]]);

const User = require('../src/models/userModel');
const Admin = require('../src/models/adminModel');
const slack = require('../src/utils/slack');
const { requireAuth } = require('../src/middlewares/requireAuth');
const admin = require('../src/controllers/adminController');

const realFind = User.findStatusById;
const realUpdate = Admin.updatePermission;
const sent = [];
slack.sendSlackMessage = async (channel, text) => sent.push([channel, text]);

const token = jwt.sign({ userId: 'hong@example.com' }, process.env.JWT_SECRET_KEY);
let account;
User.findStatusById = async () => account;
const base = { user_status: 'approved', user_role: 'member', cp_id: 1, homepage_access: 0, work_doc_access: 0, expense_approver: 0 };

const mw = () => new Promise(resolve => {
    const req = { path: '/work/expenses', headers: { cookie: `x_auth=${token}` } };
    const res = { status: () => ({ json: b => resolve(b) }) };
    requireAuth(req, res, () => resolve(req));
});
const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ userId: 'admin@example.com', userCpId: 1, userRole: 'admin', params: {}, body: {}, ...req }, res);
    return res;
};

(async () => {
    // ── requireAuth: 매 요청 DB 값 반영 ──
    account = { ...base, work_doc_access: 1 };
    let req = await mw();
    assert.strictEqual(req.workDoc, true);
    assert.strictEqual(req.expenseApprover, false);
    account = { ...base, work_doc_access: 1, expense_approver: 1 };
    req = await mw();
    assert.strictEqual(req.expenseApprover, true);
    account = { ...base, work_doc_access: 1, expense_approver: 0 };
    req = await mw();
    assert.strictEqual(req.expenseApprover, false);
    account = { ...base, user_role: 'admin' };
    req = await mw();
    assert.deepStrictEqual([req.workDoc, req.expenseApprover], [true, true]);

    // ── findStatusById SQL ──
    await realFind('x');
    assert.ok(/work_doc_access/.test(lastSql) && /expense_approver/.test(lastSql));

    // 모델 안전장치: 허용 목록 밖 칸은 throw (SQL 안 나감)
    lastSql = '';
    assert.throws(() => realUpdate(3, 'user_role', 1), /Invalid column/);
    assert.strictEqual(lastSql, '');
    await realUpdate(3, 'expense_approver', 1);
    assert.ok(/SET expense_approver = \?/.test(lastSql));

    // ── 직원별 권한 API ──
    let granted = [];
    Admin.findByMbNo = async (cpId, mbNo) => (mbNo === 3 ? { mb_no: 3, user_id: 'kim@example.com', user_name: '김직원' } : undefined);
    Admin.findByUserId = async () => ({ mb_no: 1, user_name: '관리자' });
    Admin.updatePermission = async (...args) => granted.push(args);
    const change = body => call(admin.changePermission, { params: { mbNo: '3' }, body });

    const cases = [
        [{ name: 'expense_approver', on: true }, 1, '경비 승인 권한자로 지정'],
        [{ name: 'expense_approver', on: false }, 0, '경비 승인 권한자에서 해제'],
        [{ name: 'work_doc_access', on: true }, 1, '업무 문서 권한자로 지정'],
        [{ name: 'work_doc_access', on: false }, 0, '업무 문서 권한자에서 해제'],
        [{ name: 'homepage_access', on: true }, 1, '홈페이지 관리자로 지정'],
        [{ name: 'homepage_access', on: false }, 0, '홈페이지 관리자에서 해제'],
    ];
    for (const [body, value, phrase] of cases) {
        granted = [];
        sent.length = 0;
        const res = await change(body);
        assert.deepStrictEqual(res.body, { ok: true });
        assert.deepStrictEqual(granted, [[3, body.name, value]]);
        assert.deepStrictEqual(sent, [['#hibye-관리', `관리자님이 김직원님을 ${phrase}했어요`]]);
    }

    for (const body of [{ name: 'user_role', on: true }, { name: 'expense_approver', on: '1' }, {}]) {
        granted = [];
        const res = await change(body);
        assert.deepStrictEqual([res.code, res.body.error, granted.length], [400, 'Invalid permission', 0]);
    }

    granted = [];
    const other = await call(admin.changePermission, { params: { mbNo: '99' }, body: { name: 'expense_approver', on: true } });
    assert.deepStrictEqual([other.code, granted.length], [404, 0]);

    console.log('checkWorkAuth ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkWorkAuth 실패 ❌', err.message);
    process.exit(1);
});
