// 관리자 연차·휴가 조정 API 점검: node scripts/checkBalance.js  (모델·Slack 가짜, DB 접속 없음)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
const assert = require('assert');

const slack = require('../src/utils/slack');
let notices = [];
let slackFails = false;
slack.sendSlackMessage = async (channel, text) => {
    if (slackFails) throw new Error('slack down');
    notices.push({ channel, text });
};

const Admin = require('../src/models/adminModel');
Admin.findByUserId = async (cpId, userId) => (cpId === 1 && userId === 'me@x' ? { mb_no: 1, user_name: '관리자' } : undefined);

const Balance = require('../src/models/balanceModel');
const BalanceLog = require('../src/models/balanceLog');
let adjustArgs;
let adjustImpl;
Balance.adjust = async args => ((adjustArgs = args), adjustImpl(args));
Balance.listApproved = async cpId => (cpId === 1 ? [{ mb_no: 3, user_name: '김직원', user_stip: 2.5, user_vaca: 0 }] : []);
Balance.exists = async (cpId, mbNo) => cpId === 1 && mbNo === 3;
BalanceLog.listByMember = async (cpId, mbNo) => [{ id: 1, kind: 'admin', cpId, mbNo }];

const { validateAdjust } = require('../src/utils/balanceValidation');
const admin = require('../src/controllers/adminController');
const me = { userId: 'me@x', userCpId: 1, userRole: 'admin' };
const call = async (fn, req) => {
    const res = { code: 200 };
    res.status = c => ((res.code = c), res);
    res.json = b => ((res.body = b), res);
    await fn({ ...me, params: {}, query: {}, body: {}, ...req }, res);
    return res;
};

const ok = { mbNo: 3, stip: 15, vaca: 3, expectedStip: 2.5, expectedVaca: 0 };
const body = (changes, reason = '2027년 연차 부여') => ({ reason, changes });

(async () => {
    // ── 입력 검증 ──
    for (const reason of ['', '   ', 'a'.repeat(201), null, 3]) {
        assert.deepStrictEqual(validateAdjust(body([ok], reason)), { error: 'Invalid reason' }, String(reason));
    }
    for (const changes of [undefined, 'x', [], Array.from({ length: 201 }, (_, i) => ({ ...ok, mbNo: i + 1 })), [ok, ok], [{ ...ok, mbNo: 0 }], [{ ...ok, mbNo: '3' }], [null]]) {
        assert.deepStrictEqual(validateAdjust(body(changes)), { error: 'Invalid changes' }, JSON.stringify(changes)?.slice(0, 40));
    }
    for (const bad of [{ stip: 15.3 }, { stip: -1 }, { stip: 366 }, { stip: '15' }, { stip: NaN }, { stip: Infinity }, { vaca: 1.5 }, { vaca: -1 }, { expectedStip: '2' }]) {
        assert.deepStrictEqual(validateAdjust(body([{ ...ok, ...bad }])), { error: 'Invalid balance' }, JSON.stringify(bad));
    }
    // 기대값(화면을 연 때 값)은 옛 경로가 남긴 음수·0.5 단위 아닌 값도 허용 — 그런 행을 바로잡을 수 있어야 함
    for (const legacy of [{ expectedStip: -1 }, { expectedStip: 12.3 }, { expectedVaca: -2 }, { expectedVaca: 400 }]) {
        assert.ok(!('error' in validateAdjust(body([{ ...ok, ...legacy }]))), JSON.stringify(legacy));
    }
    assert.deepStrictEqual(validateAdjust(body([{ ...ok, expectedStip: NaN }])), { error: 'Invalid balance' });
    // 경계값·null 기대값 허용, 사유는 trim
    const valid = validateAdjust(body([{ ...ok, stip: 365, vaca: 0, expectedStip: null, expectedVaca: null }, { ...ok, mbNo: 4, stip: 0.5 }], '  부여  '));
    assert.strictEqual(valid.reason, '부여');
    assert.strictEqual(valid.changes.length, 2);
    assert.ok(!('error' in valid));

    // ── 조정 API ──
    // 검증 실패 → 400, 모델 미호출
    adjustArgs = undefined;
    let res = await call(admin.adjustBalances, { body: body([ok], '') });
    assert.strictEqual(res.code, 400);
    assert.deepStrictEqual(res.body, { error: 'Invalid reason' });
    assert.strictEqual(adjustArgs, undefined);

    // 성공 → 요청자 회사·관리자 mb_no로 모델 호출, Slack 요약 1건(이스케이프)
    notices = [];
    adjustImpl = async () => ({ changed: 2 });
    res = await call(admin.adjustBalances, { body: body([ok, { ...ok, mbNo: 4 }], '2027년 <b>연차</b> 부여') });
    assert.strictEqual(res.code, 200);
    assert.deepStrictEqual(res.body, { ok: true, changed: 2 });
    assert.strictEqual(adjustArgs.cpId, 1);
    assert.strictEqual(adjustArgs.actorMbNo, 1);
    assert.strictEqual(adjustArgs.reason, '2027년 <b>연차</b> 부여');
    assert.strictEqual(adjustArgs.changes.length, 2);
    assert.deepStrictEqual(notices, [
        { channel: '#hibye-관리', text: '관리자님이 연차·휴가를 조정했어요 (2명) — 사유: 2027년 &lt;b&gt;연차&lt;/b&gt; 부여' },
    ]);

    // 모델의 상태 코드 오류는 그대로 응답, Slack 없음
    notices = [];
    adjustImpl = async () => {
        throw new Balance.BalanceError(409, 'Balance changed');
    };
    res = await call(admin.adjustBalances, { body: body([ok]) });
    assert.strictEqual(res.code, 409);
    assert.deepStrictEqual(res.body, { error: 'Balance changed' });
    assert.deepStrictEqual(notices, []);

    // 알 수 없는 오류 → 500
    adjustImpl = async () => {
        throw new Error('db down');
    };
    res = await call(admin.adjustBalances, { body: body([ok]) });
    assert.strictEqual(res.code, 500);

    // Slack 실패해도 이미 저장된 조정은 성공 응답
    slackFails = true;
    adjustImpl = async () => ({ changed: 1 });
    res = await call(admin.adjustBalances, { body: body([ok]) });
    assert.strictEqual(res.code, 200);
    assert.deepStrictEqual(res.body, { ok: true, changed: 1 });
    slackFails = false;

    // ── 목록·이력 ──
    res = await call(admin.listBalances, {});
    assert.deepStrictEqual(res.body.users.map(u => u.mb_no), [3]);
    res = await call(admin.balanceLogs, { params: { mbNo: '3' } });
    assert.strictEqual(res.code, 200);
    assert.deepStrictEqual(res.body.logs, [{ id: 1, kind: 'admin', cpId: 1, mbNo: 3 }]);
    for (const mbNo of ['9', 'abc', '0', '-1']) {
        res = await call(admin.balanceLogs, { params: { mbNo } });
        assert.strictEqual(res.code, 404, mbNo);
        assert.deepStrictEqual(res.body, { error: 'User not found' });
    }

    console.log('checkBalance ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkBalance 실패 ❌', err.message);
    process.exit(1);
});
