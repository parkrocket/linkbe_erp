// Slack 홈 화면 점검: node scripts/checkSlackHome.js  (Slack 가짜 — 실제 전송 없음)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.SLACK_BOT_TOKEN = 'xoxb-test-invalid';
const assert = require('assert');

// Slack 클라이언트 가짜: require.cache 교체 (직접 대입은 이미 만든 client에 반영되지 않음)
let published = [];
const slackPath = require.resolve('@slack/web-api');
require.cache[slackPath] = {
    id: slackPath,
    filename: slackPath,
    loaded: true,
    exports: { WebClient: class { constructor() { this.views = { publish: async args => published.push(args) }; this.chat = { postMessage: async () => {} }; } } },
};
const { publishHomeView } = require('../src/utils/slack');

const user = { user_name: '김직원', user_doe: '2024-03-04', user_stip: 7.5, user_vaca: 2 };

(async () => {
    // 출퇴근 상태와 관계없이 출퇴근 버튼·/gtw 링크 없음 (출퇴근 기록 미사용, 새 앱에 /gtw 없음)
    for (const gtw_status of [0, 1, 2]) {
        published = [];
        await publishHomeView('U1', { ...user, gtw_status, gtw_location: 'office' }, [{ start_time: '2026-11-02T09:00:00' }], [], '2026-11-02', 'enc');
        const json = JSON.stringify(published[0].view.blocks);
        assert.ok(!json.includes('/gtw'), `gtw_status ${gtw_status}: /gtw 링크 남음`);
        for (const id of ['clock_in', 'remote_clock_in', 'clock_out']) assert.ok(!json.includes(id), `${id} 버튼 남음`);
        assert.ok(!json.includes('출근 시간'), '출퇴근 상태 안내 남음');
        // 근태 신청·관리창·나의 정보는 유지
        assert.ok(json.includes('open_modal') && json.includes('https://hibye.kr/vaca'));
        assert.ok(json.includes('나의 남은연차 : 7.5일'));
    }
    console.log('checkSlackHome ✅');
    process.exit(0);
})().catch(err => {
    console.error('checkSlackHome 실패 ❌', err.message);
    process.exit(1);
});
