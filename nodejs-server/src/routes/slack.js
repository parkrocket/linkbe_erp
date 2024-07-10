const express = require('express');
const router = express.Router();
const { WebClient } = require('@slack/web-api');
const dotenv = require('dotenv');

dotenv.config();

const token = process.env.SLACK_BOT_TOKEN;
const client = new WebClient(token);

router.post('/events', async (req, res) => {
    const { type, challenge, event } = req.body;

    if (type === 'url_verification') {
        // Respond with the challenge parameter
        res.status(200).send({ challenge: challenge });
    } else if (type === 'event_callback' && event.type === 'app_home_opened') {
        const userId = event.user;

        try {
            // 사용자 정보 가져오기
            const userInfo = await client.users.info({ user: userId });

            if (userInfo.ok) {
                const userEmail = userInfo.user.profile.email;

                // Block Kit structure for home tab
                const view = {
                    type: 'home',
                    callback_id: 'home_view',
                    blocks: [
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `Welcome to your _App's Home_, ${userEmail}!`,
                            },
                        },
                        {
                            type: 'divider',
                        },
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: "*Here's a cool image:*",
                            },
                        },
                    ],
                };

                // Publish the view
                await client.views.publish({
                    user_id: userId,
                    view: view,
                });

                res.status(200).send();
            } else {
                console.error('Error fetching user info:', userInfo.error);
                res.status(500).send();
            }
        } catch (error) {
            console.error('Error publishing view:', error);
            res.status(500).send();
        }
    } else {
        res.status(200).send();
    }
});

module.exports = router;
