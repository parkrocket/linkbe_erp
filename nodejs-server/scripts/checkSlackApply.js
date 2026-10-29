// Slack 근태 신청 점검: node scripts/checkSlackApply.js  (Slack·DB·캘린더 모두 가짜)
// Slack 신청도 웹과 같은 규칙(Apply.insertMany)을 거치고, 실패 시 모달에 이유 표시, 알림은 성공 후에만
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
// 실제 Slack으로 요청이 새어 나가도 동작하지 않도록 토큰 무력화
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
process.env.SLACK_USER_TOKEN = 'xoxp-test-invalid';
const assert = require('assert');

// ── 컨트롤러가 불러오기 전에 의존 모듈을 가짜로 교체 ──
// @slack/web-api의 exports는 읽기 전용이라 대입이 무시됨 → 모듈 캐시를 직접 교체
class FakeWebClient {
    constructor() {
        this.users = { info: async () => ({ ok: true, user: { profile: { email: 'me@linkbe.kr' } } }) };
        this.chat = {
            postMessage: async () => {
                throw new Error('실제 Slack 메시지 발송 시도');
            },
        };
        this.views = { open: async () => ({}), publish: async () => ({}) };
    }
}
const slackApiPath = require.resolve('@slack/web-api');
require(slackApiPath);
require.cache[slackApiPath].exports = { ...require.cache[slackApiPath].exports, WebClient: FakeWebClient };
assert.strictEqual(require('@slack/web-api').WebClient, FakeWebClient, 'Slack 클라이언트 가짜 교체 실패');

let sentMessages = [];
const slackUtils = require('../src/utils/slack');
slackUtils.sendSlackMessage = async (channel, text) => sentMessages.push({ channel, text });

const User = require('../src/models/userModel');
User.findByEmailAsync = async () => ({ user_id: 'me@linkbe.kr', user_name: '홍길동' });
User.stipUpdateAsync = async () => {
    throw new Error('기존 차감 경로를 쓰면 안 됨');
};

const Apply = require('../src/models/applyModel');
let applyArgs;
let applyResult;
Apply.insertMany = async args => {
    applyArgs = args;
    if (applyResult instanceof Error) throw applyResult;
    return [1];
};

const { handleInteractions } = require('../src/controllers/slackController');

const submission = (type, date) => ({
    body: {
        payload: JSON.stringify({
            type: 'view_submission',
            user: { id: 'U123' },
            view: {
                state: {
                    values: {
                        input_c: { select_input: { selected_option: { value: type } } },
                        input_date: { datepicker_input: { selected_date: date } },
                    },
                },
            },
        }),
    },
});

function fakeRes() {
    const r = { code: 200, sent: 0 };
    r.status = c => ((r.code = c), r);
    r.json = b => ((r.body = b), r.sent++, r);
    r.send = b => ((r.body = b), r.sent++, r);
    return r;
}

(async () => {
    // 성공: Slack 이메일(=hibye user_id)로 같은 규칙의 신청 → 모달 닫기 → 성공 후 #출퇴근 알림
    applyResult = null;
    sentMessages = [];
    let res = fakeRes();
    await handleInteractions(submission('day', '2026-11-18'), res);
    assert.deepStrictEqual(applyArgs, { userId: 'me@linkbe.kr', dates: ['2026-11-18'], type: 'day' });
    assert.deepStrictEqual(res.body, { response_action: 'clear' });
    assert.strictEqual(res.sent, 1, '응답은 한 번만');
    assert.strictEqual(sentMessages.length, 1);
    assert.ok(sentMessages[0].text.includes('홍길동') && sentMessages[0].text.includes('연차'));

    // 규칙 위반: 모달에 이유 표시(errors), 알림 보내지 않음
    const cases = [
        ['Monthly home limit exceeded', 'input_date', '재택은 한 달에 최대 2회'],
        ['Insufficient balance', 'input_c', '남은 일수가 부족'],
        ['Already applied on this date', 'input_date', '이미 근태를 신청한 날짜'],
        ['Weekend not allowed', 'input_date', '주말'],
        ['Past date not allowed', 'input_date', '오늘 이전'],
        ['User not found', 'input_c', 'hibye 계정'],
    ];
    for (const [reason, block, text] of cases) {
        applyResult = new Apply.ApplyError(reason === 'User not found' ? 404 : reason.includes('date') || reason.includes('Weekend') ? 400 : 409, reason);
        sentMessages = [];
        res = fakeRes();
        await handleInteractions(submission('home', '2026-11-18'), res);
        assert.strictEqual(res.code, 200, 'Slack 모달 오류는 200 + response_action');
        assert.strictEqual(res.body.response_action, 'errors', reason);
        assert.ok(res.body.errors[block] && res.body.errors[block].includes(text), `${reason} → ${block}`);
        assert.strictEqual(res.sent, 1);
        assert.strictEqual(sentMessages.length, 0, '실패 시 알림 금지');
    }

    // 서버 오류: 일반 안내
    applyResult = new Error('db down');
    res = fakeRes();
    await handleInteractions(submission('day', '2026-11-18'), res);
    assert.strictEqual(res.body.response_action, 'errors');
    assert.ok(res.body.errors.input_date.includes('잠시 후'));

    console.log('checkSlackApply ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkSlackApply 실패 ❌', err.message);
    process.exit(1);
});
