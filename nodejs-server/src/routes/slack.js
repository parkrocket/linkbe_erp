const express = require('express');
const User = require('../models/userModel');
const Gtw = require('../models/gtwModel');
const moment = require('moment');
const router = express.Router();
const slackApp = require('../utils/slack');
const { WebClient } = require('@slack/web-api');
const requestIp = require('request-ip');
const crypto = require('crypto');
const { sendSlackMessage } = require('../utils/slack');

const algorithm = 'aes-256-cbc';
const secretKey = 'linkbeflatformlinkbeflatformlink'; // 32바이트 키
const ivLength = 16; // AES 블록 크기

const encrypt = (text) => {
    const iv = crypto.randomBytes(ivLength); // 암호화마다 다른 IV 사용
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (text) => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

const token = process.env.SLACK_BOT_TOKEN;
const client = new WebClient(token);

router.post('/events', async (req, res) => {
    await slackApp.requestListener()(req, res);
});

const publishHomeView = async (userId, userName, gtwStatus, date, encryptedUserId) => {
    let actionBlock;

    if (gtwStatus === 0) {
        actionBlock = {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `출근하기를 눌러주세요: <https://hibye.kr/node/api/slack/gtwCheck?userId=${encryptedUserId}&type=gtw&platform=slack|출근하기>`,
            },
            accessory: {
                type: 'button',
                text: {
                    type: 'plain_text',
                    text: '출근하기',
                },
                action_id: 'clock_in',
                value: userId,
            },
        };
    } else if (gtwStatus === 1) {
        actionBlock = {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `퇴근하기를 눌러주세요: <https://hibye.kr/node/api/slack/gtwCheck?userId=${encryptedUserId}&type=go&platform=slack|퇴근하기>`,
            },
            accessory: {
                type: 'button',
                text: {
                    type: 'plain_text',
                    text: '퇴근하기',
                },
                action_id: 'clock_out',
                value: userId,
            },
        };
    } else if (gtwStatus === 2) {
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
                    text: `${date}일 입니다. ${userName}님!`,
                },
            },
            {
                type: 'divider',
            },
            actionBlock,
        ],
    };

    try {
        await client.views.publish({
            user_id: userId,
            view: view,
        });
    } catch (error) {
        console.error('Error publishing view:', error);
    }
};

router.post('/home', async (req, res) => {
    const { type, challenge, event } = req.body;

    if (type === 'url_verification') {
        return res.status(200).send({ challenge });
    }

    if (type === 'event_callback' && event.type === 'app_home_opened') {
        const userId = event.user;

        try {
            const userInfo = await client.users.info({ user: userId });

            if (!userInfo.ok) {
                console.error('User info error:', userInfo.error);
                return res.status(500).send('User info error');
            }

            const userEmail = userInfo.user.profile.email;
            const date = moment().format('YYYY-MM-DD');
            const encryptedUserId = encrypt(`${date}|${userEmail}`);

            User.findByEmail(userEmail, async (err, user) => {
                if (err) {
                    console.error('Database query error:', err);
                    return res.status(500).json({ refreshSuccess: false, error: 'Database query error' });
                }

                if (!user) {
                    console.log('User not found:', userEmail);
                    return res.status(404).json({ refreshSuccess: false, error: 'User not found' });
                }

                await publishHomeView(userId, user.user_name, user.gtw_status, date, encryptedUserId);

                res.status(200).send();
            });
        } catch (error) {
            console.error('Error fetching user info:', error);
            res.status(500).send('Error fetching user info');
        }
    } else {
        res.status(200).send();
    }
});

router.get('/gtwCheck', async (req, res) => {
    const { userId, type, platform } = req.query;
    const date = moment().format('YYYY-MM-DD');

    let ip;
    let errorM = '';

    if (process.env.NODE_ENV === 'development') {
        ip = process.env.DEV_IP;
    } else {
        ip = req.clientIp.includes('::ffff:') ? req.clientIp.split('::ffff:')[1] : req.clientIp;
    }

    try {
        const decryptedUserId = decrypt(userId);
        const parts = decryptedUserId.split('|');

        if (date !== parts[0]) {
            return res.status(404).send('잘못된 접근입니다.');
        }

        if (process.env.COMPANY_IP !== ip) {
            return res.status(404).send('IP가 일치하지 않습니다.');
        }

        Gtw.findByGtw(parts[1], type, date, async (err, gtw) => {
            if (err) {
                return res.status(500).send('Database query error');
            }

            if (type === 'gtw' && gtw.length > 0) {
                if (gtw[0].end_time === null) {
                    errorM = '이미 출근중입니다.';
                } else {
                    errorM = '이미 퇴근하셨습니다. 내일도 화이팅.';
                }
                return res.status(200).send(errorM);
            }

            Gtw.create(parts[1], type, date, ip, platform, async (err) => {
                if (err) {
                    return res.status(500).send('Database query error');
                }

                const message = type === 'gtw' ? `${parts[1]}님이 출근하셨습니다.` : `${parts[1]}님이 퇴근하셨습니다.`;
                await sendSlackMessage('#출퇴근', message);

                try {
                    const userInfo = await client.users.info({ user: parts[1] });

                    if (userInfo.ok) {
                        const userEmail = userInfo.user.profile.email;
                        const encryptedUserId = encrypt(`${date}|${userEmail}`);

                        await publishHomeView(parts[1], userInfo.user.real_name, type === 'gtw' ? 1 : 2, date, encryptedUserId);
                    }
                } catch (publishError) {
                    console.error('Error publishing view:', publishError);
                }

                return res.send('출근완료');
            });
        });
    } catch (error) {
        return res.status(400).send('Invalid user ID');
    }
});

router.post('/interactions', express.urlencoded({ extended: true }), async (req, res) => {
    const date = moment().format('YYYY-MM-DD');

    const payload = JSON.parse(req.body.payload);

    const { type, user, actions } = payload;

    console.log(actions);
});

module.exports = router;
