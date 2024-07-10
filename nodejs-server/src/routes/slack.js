const express = require('express');
const User = require('../models/userModel');
const moment = require('moment');
const router = express.Router();
const slackApp = require('../utils/slack');
const { WebClient } = require('@slack/web-api');
const requestIp = require('request-ip');

const token = process.env.SLACK_BOT_TOKEN;
const client = new WebClient(token);

router.post('/events', async (req, res) => {
    await slackApp.requestListener()(req, res);
});

router.post('/home', async (req, res) => {
    const { type, challenge, event } = req.body;

    if (type === 'url_verification') {
        // Respond with the challenge parameter
        res.status(200).send({ challenge: challenge });
    } else if (type === 'event_callback' && event.type === 'app_home_opened') {
        const userId = event.user;

        const userInfo = await client.users.info({ user: userId });
        const date = moment().format('YYYY-MM-DD');

        // Block Kit structure for home tab
        if (userInfo.ok) {
            const userEmail = userInfo.user.profile.email;

            User.findByEmail(userEmail, async (err, user) => {
                //return res.status(500).json({ message: 'Login successful', user: user });

                if (err) {
                    return res.status(200).json({ refreshSuccess: false, error: 'Database query error' });
                }
                if (!user) {
                    return res.status(200).json({ refreshSuccess: false, error: 'User not found' });
                }

                // 동적으로 블록 생성
                let actionBlock;
                if (user.gtw_status === 0) {
                    actionBlock = {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `출근하기를 눌러주세요: [출근하기](https://hibye.kr/gtw?userId=${userEmail},'출근하기')`,
                        },
                        accessory: {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: '출근하기',
                            },
                            action_id: 'clock_in',
                            value: user.user_id,
                        },
                    };
                } else if (user.gtw_status === 1) {
                    actionBlock = {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `퇴근하기를 눌러주세요: [퇴근하기](https://hibye.kr/gtw?userId=${userEmail},'퇴근하기')`,
                        },
                        accessory: {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: '퇴근하기',
                            },
                            action_id: 'clock_out',
                            value: user.user_id,
                        },
                    };
                } else if (user.gtw_status === 2) {
                    actionBlock = {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: '오늘 하루 수고하셨습니다!',
                        },
                    };
                }

                const view = {
                    type: 'home',
                    callback_id: 'home_view',
                    blocks: [
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `${date}일 입니다. ${user.user_name}님!`,
                            },
                        },
                        {
                            type: 'divider',
                        },
                        actionBlock,
                    ],
                };

                // Publish the view
                try {
                    await client.views.publish({
                        user_id: userId,
                        view: view,
                    });
                    res.status(200).send();
                } catch (error) {
                    console.error('Error publishing view:', error);
                    res.status(500).send();
                }
            });
        } else {
            console.log('유저정보 에러');
        }
    } else {
        res.status(200).send();
    }
});

router.post('/interactions', express.urlencoded({ extended: true }), async (req, res) => {
    const date = moment().format('YYYY-MM-DD');

    const payload = JSON.parse(req.body.payload);

    const { type, user, actions } = payload;

    if (type === 'block_actions') {
        const userId = user.id;
        const actionId = actions[0].action_id;

        if (actionId === 'clock_in') {
            const redirectUrl = 'https://hibye.kr';

            try {
                // 사용자에게 리디렉션 링크를 포함한 메시지 보내기
                await client.chat.postMessage({
                    channel: userId,
                    text: `Please click the following link to proceed: ${redirectUrl}`,
                });

                res.status(200).send();
            } catch (error) {
                console.error('Error sending message:', error);
                res.status(500).send('Internal Server Error');
            }
        }
    }
    console.log(actions);
});

module.exports = router;
