const { WebClient } = require('@slack/web-api');

const token = process.env.SLACK_BOT_TOKEN; // Bot User OAuth Token을 사용
const web = new WebClient(token);

const sendSlackMessage = async (channel, text) => {
    try {
        await web.chat.postMessage({
            channel: channel,
            text: text,
        });
    } catch (error) {
        console.error('Error sending Slack message: ', error);
    }
};

module.exports = {
    sendSlackMessage,
};
