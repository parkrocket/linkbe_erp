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
const base = { user_status: 'approved', user_role: 'member', cp_id: 1, homepage_access: 0, work_doc_access: 0, expense_approver: 0, client_secret_access: 0 };

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
    assert.strictEqual(req.clientSecret, true); // 관리자
    account = { ...base, client_secret_access: 1 };
    req = await mw();
    assert.deepStrictEqual([req.clientSecret, req.workDoc], [true, false]); // 업무 문서 권한과 별개
    account = { ...base, work_doc_access: 1, expense_approver: 1 };
    req = await mw();
    assert.strictEqual(req.clientSecret, false);

    // ── findStatusById SQL ──
    await realFind('x');
    assert.ok(/work_doc_access/.test(lastSql) && /expense_approver/.test(lastSql) && /client_secret_access/.test(lastSql));

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
        [{ name: 'client_secret_access', on: true }, 1, '거래처 접속정보 권한자로 지정'],
        [{ name: 'client_secret_access', on: false }, 0, '거래처 접속정보 권한자에서 해제'],
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

    // ── 실제 라우터: 업무 문서 권한이 없는 직원(경비만)은 계약·업체·설정 403, 경비 API는 그대로 ──
    const express = require('express');
    const app = express();
    let flags = { workDoc: false };
    app.use((r, _res, next) => Object.assign(r, { userId: 'hong@example.com', userCpId: 1, expenseApprover: false }, flags) && next());
    app.use('/api/work', require('../src/routes/work'));
    const server = app.listen(0);
    const port = server.address().port;
    const status = async (method, p) => (await fetch(`http://127.0.0.1:${port}/api/work${p}`, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' })).status;
    for (const [method, p] of [['GET', '/contracts'], ['GET', '/contracts/companies?q=a'], ['GET', '/contracts/1'], ['POST', '/contracts'], ['DELETE', '/contracts/1'], ['GET', '/doc-settings'], ['GET', '/doc-settings/doc-templates/1'], ['POST', '/doc-settings/doc-templates'], ['POST', '/doc-settings/categories'], ['GET', '/ledger'], ['GET', '/ledger/1'], ['POST', '/ledger'], ['POST', '/ledger/1'], ['DELETE', '/ledger/1'], ['GET', '/accounts'], ['POST', '/accounts'], ['POST', '/accounts/1'], ['DELETE', '/accounts/1'], ['GET', '/boards/viral'], ['POST', '/boards/viral'], ['GET', '/boards/viral/1'], ['POST', '/boards/viral/1'], ['DELETE', '/boards/viral/1'], ['POST', '/boards/viral/1/comments'], ['DELETE', '/boards/viral/1/comments/2']]) {
        assert.strictEqual(await status(method, p), 403, `${method} ${p} 권한 없는 직원에게 열려 있음`);
    }
    assert.strictEqual(await status('GET', '/summary'), 200, '경비 API가 막힘');
    flags = { workDoc: true };
    assert.notStrictEqual(await status('GET', '/doc-settings/item-templates'), 403, '권한자가 막힘'); // 권한 통과 후 입력 오류(400)

    // ── 업무 설정(분류·품목 문구·양식·계정과목) 쓰기는 관리자만(11-05) — 읽기는 업무 문서 권한자에게 그대로(견적 작성·장부가 씀) ──
    const settingWrites = [
        ['POST', '/doc-settings/categories'], ['POST', '/doc-settings/categories/1'], ['POST', '/doc-settings/categories/1/move'], ['DELETE', '/doc-settings/categories/1'],
        ['POST', '/doc-settings/item-templates'], ['POST', '/doc-settings/item-templates/1'], ['POST', '/doc-settings/item-templates/1/move'], ['DELETE', '/doc-settings/item-templates/1'],
        ['POST', '/doc-settings/doc-templates'], ['POST', '/doc-settings/doc-templates/1'], ['DELETE', '/doc-settings/doc-templates/1'],
        ['POST', '/accounts'], ['POST', '/accounts/1'], ['DELETE', '/accounts/1'],
    ];
    flags = { workDoc: true, userRole: 'member' };
    for (const [method, p] of settingWrites) {
        const res = await fetch(`http://127.0.0.1:${port}/api/work${p}`, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
        assert.deepStrictEqual([res.status, (await res.json()).error], [403, 'Admin only'], `${method} ${p} 관리자 아닌 업무 문서 권한자에게 열려 있음`);
    }
    for (const p of ['/doc-settings', '/doc-settings/item-templates', '/doc-settings/doc-templates/1', '/accounts']) {
        assert.notStrictEqual(await status('GET', p), 403, `GET ${p} 읽기가 막힘`);
    }
    flags = { workDoc: true, userRole: 'admin' };
    for (const [method, p] of settingWrites) assert.notStrictEqual(await status(method, p), 403, `${method} ${p} 관리자가 막힘`);

    // ── 거래처 접속정보: 업무 문서 권한만·경비 승인만 있는 직원은 전 경로 403(첨부 받기·내려받기 포함) ──
    const clientPaths = [
        ['GET', '/clients'], ['POST', '/clients'], ['GET', '/clients/1'], ['POST', '/clients/1'], ['DELETE', '/clients/1'],
        ['POST', '/clients/1/credentials'], ['POST', '/clients/1/credentials/2'], ['DELETE', '/clients/1/credentials/2'],
        ['POST', '/clients/1/credentials/2/reveal'], ['POST', '/clients/1/legacy-memo/reveal'],
        ['POST', '/clients/1/files'], ['GET', '/clients/1/files/2'], ['DELETE', '/clients/1/files/2'],
    ];
    for (const f of [{ workDoc: true, clientSecret: false }, { workDoc: false, expenseApprover: true }, { workDoc: false }]) {
        flags = f;
        for (const [method, p] of clientPaths) assert.strictEqual(await status(method, p), 403, `${method} ${p} 접속정보 권한 없는 직원에게 열려 있음 ${JSON.stringify(f)}`);
    }
    flags = { workDoc: false, clientSecret: true };
    assert.strictEqual(await status('POST', '/clients'), 400, '접속정보 권한자가 막힘'); // 권한 통과 후 입력 오류
    assert.strictEqual(await status('GET', '/contracts'), 403, '접속정보 권한이 업무 문서 권한을 엶');
    server.close();

    console.log('checkWorkAuth ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkWorkAuth 실패 ❌', err.message);
    process.exit(1);
});
