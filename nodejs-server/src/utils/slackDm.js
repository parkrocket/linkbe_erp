const { WebClient } = require('@slack/web-api');

const defaultClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// 이메일로 Slack 사용자를 찾아 개인 DM 전송. 실패해도 throw 하지 않고 false
// 봇 권한 users:read.email 필요 (없으면 missing_scope 경고가 로그에 남음)
const sendDm = async (email, text, client = defaultClient) => {
    try {
        const { user } = await client.users.lookupByEmail({ email });
        await client.chat.postMessage({ channel: user.id, text });
        return true;
    } catch (error) {
        console.warn('Slack DM 실패:', (error.data && error.data.error) || error.message);
        return false;
    }
};

module.exports = { sendDm };
