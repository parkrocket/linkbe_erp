// 관리자 API 점검: node scripts/checkAdmin.js  (DB·Slack 가짜)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
const assert = require('assert');

const slack = require('../src/utils/slack');
let notices = [];
slack.sendSlackMessage = async (channel, text) => notices.push({ channel, text });

// ── 가짜 직원 데이터 (회사 1: 관리자 me + 직원들, 회사 2: other) ──
const Admin = require('../src/models/adminModel');
let users;
let updates;
const reset = extra => {
    notices = [];
    updates = [];
    users = [
        { mb_no: 1, cp_id: 1, user_id: 'me@x', user_name: '관리자', user_role: 'admin', user_status: 'approved', user_password: 'h' },
        { mb_no: 2, cp_id: 1, user_id: 'new@x', user_name: '신입', user_role: 'member', user_status: 'pending', user_password: 'h' },
        { mb_no: 3, cp_id: 1, user_id: 'kim@x', user_name: '김직원', user_role: 'member', user_status: 'approved', user_password: 'h' },
        { mb_no: 9, cp_id: 2, user_id: 'other@x', user_name: '타사', user_role: 'member', user_status: 'pending', user_password: 'h' },
        ...(extra || []),
    ];
};
Admin.listUsers = async (cpId, status) =>
    users.filter(u => u.cp_id === cpId && (!status || u.user_status === status)).map(({ user_password, ...u }) => u);
Admin.pendingCount = async cpId => users.filter(u => u.cp_id === cpId && u.user_status === 'pending').length;
Admin.findByMbNo = async (cpId, mbNo) => users.find(u => u.cp_id === cpId && u.mb_no === mbNo);
Admin.findByUserId = async (cpId, userId) => users.find(u => u.cp_id === cpId && u.user_id === userId);
Admin.countApprovedAdmins = async cpId =>
    users.filter(u => u.cp_id === cpId && u.user_role === 'admin' && u.user_status === 'approved').length;
Admin.updateStatus = async (mbNo, status) => updates.push(['status', mbNo, status]);
Admin.updateRole = async (mbNo, role) => updates.push(['role', mbNo, role]);

const admin = require('../src/controllers/adminController');
const me = { userId: 'me@x', userCpId: 1, userRole: 'admin' };
const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ ...me, params: {}, query: {}, body: {}, ...req }, res);
    return res;
};

(async () => {
    // 목록: 같은 회사만, 비밀번호 해시 없음, 상태 필터
    reset();
    let res = await call(admin.listUsers, {});
    assert.deepStrictEqual(res.body.users.map(u => u.mb_no), [1, 2, 3]);
    assert.ok(res.body.users.every(u => !('user_password' in u)));
    res = await call(admin.listUsers, { query: { status: 'pending' } });
    assert.deepStrictEqual(res.body.users.map(u => u.mb_no), [2]);
    res = await call(admin.listUsers, { query: { status: 'weird' } });
    assert.strictEqual(res.code, 400, '알 수 없는 상태 필터');

    // 요약
    res = await call(admin.summary, {});
    assert.deepStrictEqual(res.body, { pendingCount: 1 });

    // 승인: pending → approved, Slack 기록
    reset();
    res = await call(admin.changeStatus, { params: { mbNo: '2' }, body: { status: 'approved' } });
    assert.strictEqual(res.code, 200);
    assert.deepStrictEqual(updates, [['status', 2, 'approved']]);
    assert.strictEqual(notices.length, 1);
    assert.strictEqual(notices[0].channel, '#hibye-관리');
    assert.ok(notices[0].text.includes('관리자') && notices[0].text.includes('신입') && notices[0].text.includes('승인'));

    // 허용되지 않는 전이 → 400, 변경·알림 없음
    reset();
    res = await call(admin.changeStatus, { params: { mbNo: '3' }, body: { status: 'rejected' } });
    assert.strictEqual(res.code, 400);
    assert.strictEqual(res.body.error, 'Invalid transition');
    assert.deepStrictEqual(updates, []);
    assert.strictEqual(notices.length, 0);

    // 다른 회사 직원 → 404
    reset();
    res = await call(admin.changeStatus, { params: { mbNo: '9' }, body: { status: 'approved' } });
    assert.strictEqual(res.code, 404);
    res = await call(admin.changeRole, { params: { mbNo: '9' }, body: { role: 'admin' } });
    assert.strictEqual(res.code, 404);

    // 자기 자신 변경 → 409
    reset();
    res = await call(admin.changeStatus, { params: { mbNo: '1' }, body: { status: 'inactive' } });
    assert.strictEqual(res.code, 409);
    assert.strictEqual(res.body.error, 'Cannot change yourself');
    res = await call(admin.changeRole, { params: { mbNo: '1' }, body: { role: 'member' } });
    assert.strictEqual(res.body.error, 'Cannot change yourself');

    // 마지막 관리자 보호 — 다른 관리자(요청자)가 유일한 '승인된' 관리자를 해제하려는 상황
    // 요청자 me는 inactive 관리자가 아니라 승인 관리자여야 하므로, 대상 boss만 승인 관리자이고 me는 승인 관리자 아님을 흉내
    reset([{ mb_no: 5, cp_id: 1, user_id: 'boss@x', user_name: '대표', user_role: 'admin', user_status: 'approved' }]);
    users[0].user_role = 'member'; // 요청자 권한은 미들웨어가 이미 확인했다고 가정, DB상 승인 관리자는 boss 1명
    res = await call(admin.changeRole, { params: { mbNo: '5' }, body: { role: 'member' } });
    assert.strictEqual(res.code, 409);
    assert.strictEqual(res.body.error, 'Last admin');
    res = await call(admin.changeStatus, { params: { mbNo: '5' }, body: { status: 'inactive' } });
    assert.strictEqual(res.body.error, 'Last admin');
    assert.deepStrictEqual(updates, []);

    // 관리자 2명이면 다른 관리자 해제 가능
    reset([{ mb_no: 5, cp_id: 1, user_id: 'boss@x', user_name: '대표', user_role: 'admin', user_status: 'approved' }]);
    res = await call(admin.changeRole, { params: { mbNo: '5' }, body: { role: 'member' } });
    assert.strictEqual(res.code, 200);
    assert.deepStrictEqual(updates, [['role', 5, 'member']]);
    assert.ok(notices[0].text.includes('관리자 해제'));

    // 관리자 지정, 잘못된 권한 값
    reset();
    res = await call(admin.changeRole, { params: { mbNo: '3' }, body: { role: 'admin' } });
    assert.strictEqual(res.code, 200);
    assert.ok(notices[0].text.includes('관리자로 지정'));
    res = await call(admin.changeRole, { params: { mbNo: '3' }, body: { role: 'owner' } });
    assert.strictEqual(res.code, 400);
    assert.strictEqual(res.body.error, 'Invalid role');

    // 잘못된 번호
    res = await call(admin.changeStatus, { params: { mbNo: 'abc' }, body: { status: 'approved' } });
    assert.strictEqual(res.code, 404);

    console.log('checkAdmin ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkAdmin 실패 ❌', err.message);
    process.exit(1);
});
