// 정기 작업 등록 점검: node scripts/checkUserCron.js  (node-cron·월차 로직 가짜 — 실제 실행·DB 없음)
const assert = require('assert');

// node-cron 가짜: require.cache 교체 (직접 대입은 이미 로드된 모듈에 반영되지 않음)
const schedules = [];
const cronPath = require.resolve('node-cron');
require.cache[cronPath] = { id: cronPath, filename: cronPath, loaded: true, exports: { schedule: (expr, fn, opts) => schedules.push({ expr, fn, opts }) } };

process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
const slack = require('../src/utils/slack');
const alerts = [];
slack.sendSlackMessage = async (channel, text) => alerts.push({ channel, text });

const MonthlyGrant = require('../src/models/monthlyGrant');
const calls = [];
let fail = false;
MonthlyGrant.run = async today => {
    calls.push(['run', today]);
    if (fail) throw new Error('db down');
    return { month: today.slice(0, 7), granted: [] };
};
MonthlyGrant.notify = async result => calls.push(['notify', result.month]);

(async () => {
    const { grantMonthly, catchUp } = require('../src/controllers/userCron');
    await new Promise(r => setImmediate(r)); // 시작 시 실행 대기

    // 매달 1일 00:05 한국 시간 (서버 시계는 UTC)
    const monthly = schedules.find(s => s.expr === '5 0 1 * *');
    assert.ok(monthly, '월차 스케줄 등록');
    assert.deepStrictEqual(monthly.opts, { timezone: 'Asia/Seoul' });
    // node-cron은 콜백에 실행 시각(Date)을 넘김 — 그 값을 '오늘'로 쓰지 않고 KST 오늘 문자열로 실행
    calls.length = 0;
    await monthly.fn(new Date());
    assert.match(calls[0][1], /^\d{4}-\d{2}-\d{2}$/);

    // 시작 시 보충은 1~3일에만 — 월 중간 배포·재시작으로 그 달 몫이 갑자기 부여되지 않게
    // (도입 전 수동으로 준 달과 겹쳐 이중 부여 방지)
    calls.length = 0;
    await catchUp('2026-10-30');
    assert.deepStrictEqual(calls, [], '월 중간에는 보충하지 않음');
    await catchUp('2026-11-02');
    assert.deepStrictEqual(calls, [['run', '2026-11-02'], ['notify', '2026-11']], '1일 서버 중단 보충');
    calls.length = 0;
    await catchUp('2026-11-04');
    assert.deepStrictEqual(calls, []);

    // 실패해도 서버가 죽지 않음 (로그만)
    fail = true;
    await grantMonthly('2026-11-01');
    // 실패는 조용히 넘어가지 않게 관리 채널에 알림 (재시도는 관리자 판단)
    assert.deepStrictEqual(alerts, [{ channel: '#hibye-관리', text: '⚠️ 2026-11 월차 자동 부여에 실패했어요. 서버 로그를 확인해 주세요.' }]);
    console.log('checkUserCron ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkUserCron 실패 ❌', err.message);
    process.exit(1);
});
