// 접속 차단 IP·가입 신청 삭제 점검: node scripts/checkIpBlock.js  (DB·Slack 가짜)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
process.env.COMPANY_IP = '1.1.1.1, 2.2.2.2';
const assert = require('assert');

const slack = require('../src/utils/slack');
let notices = [];
slack.sendSlackMessage = async (channel, text) => notices.push(text);

// 가짜 DB — 차단 목록 SELECT만 (ipBlock 캐시가 읽음)
const pool = require('../src/config/dbPromise');
let blockedRows = [];
let dbDown = false;
pool.query = async sql => {
    if (dbDown) throw new Error('down');
    if (/SELECT ip FROM lk_blocked_ip/.test(sql)) return [blockedRows];
    throw new Error(`unexpected sql: ${sql}`);
};

const Admin = require('../src/models/adminModel');
const users = [
    { mb_no: 1, cp_id: 1, user_id: 'me@x', user_name: '관리자', user_role: 'admin', user_status: 'approved', last_login_ip: '9.9.9.9' },
    { mb_no: 2, cp_id: 1, user_id: 'new@x', user_name: '신입', user_role: 'member', user_status: 'pending', last_login_ip: '5.5.5.5' },
    { mb_no: 3, cp_id: 1, user_id: 'kim@x', user_name: '김직원', user_role: 'member', user_status: 'approved', last_login_ip: '::ffff:6.6.6.6' },
    { mb_no: 9, cp_id: 2, user_id: 'other@x', user_name: '타사', user_role: 'member', user_status: 'pending', last_login_ip: '7.7.7.7' },
];
Admin.findByMbNo = async (cpId, mbNo) => users.find(u => u.cp_id === cpId && u.mb_no === mbNo);
Admin.findByUserId = async (cpId, userId) => users.find(u => u.cp_id === cpId && u.user_id === userId);
let deleted = [];
Admin.deleteApplicant = async (cpId, mbNo) => {
    const u = users.find(x => x.cp_id === cpId && x.mb_no === mbNo && ['pending', 'rejected'].includes(x.user_status));
    if (u) deleted.push(mbNo);
    return !!u;
};

const BlockedIp = require('../src/models/blockedIpModel');
let added = [];
BlockedIp.add = async (cpId, v) => {
    if (blockedRows.some(r => r.ip === v.ip)) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
    added.push({ cpId, ...v });
    blockedRows.push({ ip: v.ip });
    return 1;
};
BlockedIp.find = async (cpId, id) => (cpId === 1 && id === 5 ? { id: 5, ip: '8.8.8.8' } : null);
BlockedIp.remove = async () => {
    blockedRows = blockedRows.filter(r => r.ip !== '8.8.8.8');
    return true;
};

const ipBlock = require('../src/utils/ipBlock');
const blockedIp = require('../src/controllers/adminBlockedIpController');
const admin = require('../src/controllers/adminController');
const me = { userId: 'me@x', userCpId: 1, userRole: 'admin', ip: '9.9.9.9', headers: {} };
const call = async (fn, req) => {
    const res = { code: 200, headers: {} };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    res.set = (k, v) => ((res.headers[k] = v), res);
    await fn({ ...me, params: {}, query: {}, body: {}, ...req }, res);
    return res;
};
const mw = async (path, ip) => {
    let passed = false;
    const res = await call((req, r) => ipBlock.blockMiddleware(req, r, () => (passed = true)), { path, ip });
    return passed ? 'next' : res.code;
};

(async () => {
    // IP 형식
    assert.strictEqual(ipBlock.normalizeIp(' ::ffff:1.2.3.4 '), '1.2.3.4');
    assert.strictEqual(ipBlock.normalizeIp('2001:DB8::1'), '2001:db8::1');
    assert.strictEqual(ipBlock.normalizeIp('1.2.3'), '');
    assert.strictEqual(ipBlock.normalizeIp('1.2.3.4/24'), '');
    assert.ok(ipBlock.protectedIps().has('2.2.2.2') && ipBlock.protectedIps().has('127.0.0.1'), '사무실·루프백 보호');

    // 미들웨어: 차단 IP는 직원 API 403, 공개 API·Slack·헬스체크·내부 목록은 통과
    blockedRows = [{ ip: '4.4.4.4' }];
    await ipBlock.invalidate();
    assert.strictEqual(await mw('/users/login', '::ffff:4.4.4.4'), 403);
    assert.strictEqual(await mw('/work/contracts', '4.4.4.4'), 403);
    assert.strictEqual(await mw('/users/login', '4.4.4.5'), 'next');
    for (const p of ['/public/homepage/posts', '/slack/actions', '/test', '/internal/blocked-ips']) assert.strictEqual(await mw(p, '4.4.4.4'), 'next', p);

    // DB가 죽어도 직전 목록 유지(사이트가 통째로 닫히거나 열리지 않게)
    dbDown = true;
    await ipBlock.invalidate();
    assert.strictEqual(await mw('/users/login', '4.4.4.4'), 403);
    dbDown = false;

    // 내부 목록: 서버 안 직접 요청만(nginx를 거치면 X-Forwarded-For가 붙음)
    let res = await call(ipBlock.internalList, { ip: '127.0.0.1', headers: {} });
    assert.deepStrictEqual(res.body, { ips: ['4.4.4.4'] });
    res = await call(ipBlock.internalList, { ip: '127.0.0.1', headers: { 'x-forwarded-for': '4.4.4.4' } });
    assert.strictEqual(res.code, 404);
    res = await call(ipBlock.internalList, { ip: '3.3.3.3', headers: {} });
    assert.strictEqual(res.code, 404);

    // 추가: 형식·사무실·내 IP·이미 차단 거절
    const add = body => call(blockedIp.add, { body });
    assert.strictEqual((await add({ ip: 'abc' })).body.error, 'Invalid ip');
    assert.strictEqual((await add({ ip: '1.1.1.1' })).body.error, 'Protected ip');
    assert.strictEqual((await add({ ip: '9.9.9.9' })).body.error, 'Protected ip', '지금 내 IP');
    assert.strictEqual((await add({ ip: '4.4.4.4' })).body.error, 'Already blocked');
    assert.strictEqual((await add({ ip: '3.3.3.3', reason: 'x'.repeat(201) })).body.error, 'Invalid reason');

    // 직원에서 차단: 같은 회사·그 직원의 마지막 IP일 때만, 자기 자신 거절
    assert.strictEqual((await add({ ip: '7.7.7.7', mbNo: 9 })).code, 404, '다른 회사 직원');
    assert.strictEqual((await add({ ip: '5.5.5.6', mbNo: 2 })).body.error, 'Ip changed');
    notices = [];
    res = await add({ ip: '6.6.6.6', mbNo: 3, reason: '퇴사 <후>' });
    assert.strictEqual(res.code, 200);
    assert.deepStrictEqual(added.at(-1), { cpId: 1, ip: '6.6.6.6', reason: '퇴사 <후>', mbNo: 3, createdBy: 'me@x' });
    assert.ok(notices[0].includes('6.6.6.6') && notices[0].includes('&lt;후&gt;'), 'Slack 기록·이스케이프');
    assert.strictEqual(await mw('/users/auth', '6.6.6.6'), 403, '추가 즉시 반영');

    // 해제: 같은 회사 것만, 즉시 반영
    blockedRows.push({ ip: '8.8.8.8' });
    await ipBlock.invalidate();
    assert.strictEqual((await call(blockedIp.remove, { params: { id: '6' } })).code, 404);
    assert.strictEqual(await mw('/users/auth', '8.8.8.8'), 403);
    assert.strictEqual((await call(blockedIp.remove, { params: { id: '5' } })).code, 200);
    assert.strictEqual(await mw('/users/auth', '8.8.8.8'), 'next');

    // 가입 신청 삭제: 대기·거절만, 승인 직원·자기 자신·다른 회사 거절
    users.push({ mb_no: 4, cp_id: 1, user_id: 'no@x', user_name: '거절자', user_status: 'rejected' });
    assert.strictEqual((await call(admin.deleteApplicant, { params: { mbNo: '3' } })).body.error, 'Not applicant');
    assert.strictEqual((await call(admin.deleteApplicant, { params: { mbNo: '1' } })).body.error, 'Cannot change yourself');
    assert.strictEqual((await call(admin.deleteApplicant, { params: { mbNo: '9' } })).code, 404);
    assert.strictEqual((await call(admin.deleteApplicant, { params: { mbNo: '2' } })).code, 200);
    assert.strictEqual((await call(admin.deleteApplicant, { params: { mbNo: '4' } })).code, 200);
    assert.deepStrictEqual(deleted, [2, 4]);

    console.log('checkIpBlock: 모든 점검 통과');
    process.exit(0);
})().catch(e => {
    console.error(e);
    process.exit(1);
});
