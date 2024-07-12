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

const publishHomeView = async (userId, user, gtw, myGtw, date, encryptedUserId) => {
    const userName = user.user_name;
    const gtwStatus = user.gtw_status;
    const gtwLocation = user.gtw_location;

    let actionBlocks = [];
    // 다른 사람들의 출퇴근 정보 표시
    if (gtw.length > 0) {
        let gtwText = '근무중 / 출근시간\n\n';
        gtw.forEach((entry) => {
            let locationIcon = entry.location === 'office' ? '🏢' : '🏠';
            let formattedStartTime = moment(entry.start_time).format('HH시 mm분 ss초');
            gtwText += `${locationIcon} ${entry.user_name} : ${formattedStartTime}\n`;
        });

        actionBlocks.push(
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: gtwText,
                },
            },
            {
                type: 'divider',
            }
        );
    }

    if (myGtw.length > 0) {
        let formattedStartTime = moment(myGtw[0].start_time).format('HH시 mm분 ss초');
        let formattedEndTime;
        let endTimeLabel;

        if (myGtw[0].end_time) {
            // 실제 퇴근 시간이 있는 경우
            formattedEndTime = moment(myGtw[0].end_time).format('HH시 mm분 ss초');
            endTimeLabel = '퇴근 시간';
        } else {
            // 퇴근 예상 시간을 계산
            let estimatedEndTime = moment(myGtw[0].start_time).add(9, 'hours').format('HH시 mm분 ss초');
            formattedEndTime = estimatedEndTime;
            endTimeLabel = '퇴근 예상시간';
        }

        actionBlocks.push(
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `나의 근무 상태:\n\n출근 시간: ${formattedStartTime}\n${endTimeLabel}: ${formattedEndTime}`,
                },
            },
            {
                type: 'divider',
            }
        );
    }
    if (gtwStatus === 0) {
        actionBlocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '출근 옵션을 선택하세요:',
            },
        });
        actionBlocks.push({
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: '출근하기',
                    },
                    url: `https://hibye.kr/gtw?userId=${encryptedUserId}&type=gtw&platform=slack&slackuser=${userId}`,
                    action_id: 'clock_in',
                },
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: '재택출근하기',
                    },
                    url: `https://hibye.kr/gtw?userId=${encryptedUserId}&type=remote_gtw&platform=slack&slackuser=${userId}`,
                    action_id: 'remote_clock_in',
                },
            ],
        });
    } else if (gtwStatus === 1) {
        let url;

        if (gtwLocation === 'office') {
            url = `https://hibye.kr/gtw?userId=${encryptedUserId}&type=go&platform=slack&slackuser=${userId}`;
        } else {
            url = `https://hibye.kr/gtw?userId=${encryptedUserId}&type=remote_go&platform=slack&slackuser=${userId}`;
        }

        actionBlocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '퇴근하기를 눌러주세요:',
            },
            accessory: {
                type: 'button',
                text: {
                    type: 'plain_text',
                    text: '퇴근하기',
                },
                url: url,
                action_id: 'clock_out',
            },
        });
    } else if (gtwStatus === 2) {
        actionBlocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '오늘 하루 수고하셨습니다!',
            },
        });
    }

    // 새로운 버튼을 추가합니다.
    actionBlocks.push(
        {
            type: 'divider',
        },
        {
            type: 'actions',
            elements: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '🏖️ 휴가 및 연차신청',
                    },
                },
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: '신청하기',
                        emoji: true,
                    },
                    action_id: 'open_modal',
                },
            ],
        }
    );

    const blocks = [
        {
            type: 'context',
            elements: [
                {
                    type: 'plain_text',
                    text: `🎉 ${date}일 입니다. ${userName}님!`,
                    emoji: true,
                },
            ],
        },
        {
            type: 'divider',
        },
        ...actionBlocks,
    ];

    const view = {
        type: 'home',
        callback_id: 'home_view',
        blocks: blocks,
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

// 모달을 띄우는 함수
const openModal = async (trigger_id) => {
    try {
        await client.views.open({
            trigger_id: trigger_id,
            view: {
                type: 'modal',
                callback_id: 'modal-identifier',
                title: {
                    type: 'plain_text',
                    text: '휴가 및 연차신청',
                },
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: '휴가 및 연차를 신청해주세요.',
                        },
                    },
                    {
                        type: 'input',
                        block_id: 'input_c',
                        label: {
                            type: 'plain_text',
                            text: '선택 항목',
                        },
                        element: {
                            type: 'static_select',
                            action_id: 'select_input',
                            placeholder: {
                                type: 'plain_text',
                                text: '옵션을 선택하세요',
                            },
                            options: [
                                {
                                    text: {
                                        type: 'plain_text',
                                        text: '옵션 1',
                                    },
                                    value: 'option_1',
                                },
                                {
                                    text: {
                                        type: 'plain_text',
                                        text: '옵션 2',
                                    },
                                    value: 'option_2',
                                },
                                {
                                    text: {
                                        type: 'plain_text',
                                        text: '옵션 3',
                                    },
                                    value: 'option_3',
                                },
                            ],
                        },
                    },
                ],
                submit: {
                    type: 'plain_text',
                    text: '제출',
                },
            },
        });
    } catch (error) {
        console.error('Error opening modal:', error);
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

            const user = await User.findByEmailAsync(userEmail);
            if (!user) {
                console.log('User not found:', userEmail);
                return res.status(404).json({ refreshSuccess: false, error: 'User not found' });
            }

            const gtw = await Gtw.findByGtwAllAsync(date);
            const myGtw = await Gtw.findByGtwAsync(user.user_id, date);

            await publishHomeView(userId, user, gtw, myGtw, date, encryptedUserId);

            res.status(200).send();
        } catch (error) {
            console.error('Error fetching user info:', error);
            res.status(500).send('Error fetching user info');
        }
    } else {
        res.status(200).send();
    }
});

router.get('/gtwCheck', async (req, res) => {
    const { userId, type, platform, slackuser } = req.query;
    const date = moment().format('YYYY-MM-DD');
    const dateNow = moment().format('HH시mm분ss초');

    let location;
    if (type === 'gtw' || type === 'go') location = 'office';
    if (type === 'remote_gtw' || type === 'remote_go') location = 'home';

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
            return res.json({ message: '잘못된 접근입니다.', windowClose: false });
        }

        if ((type === 'gtw' || type === 'go') && process.env.COMPANY_IP !== ip) {
            console.log('ip', ip);

            return res.json({ message: 'ip가 일치하지 않습니다.', windowClose: false });
        }

        try {
            const gtw = await Gtw.findByGtwAsync(parts[1], date);
            if (type === 'gtw' && gtw.length > 0) {
                if (gtw[0].end_time === null) {
                    errorM = '이미 출근중입니다.';
                } else {
                    errorM = '이미 퇴근하셨습니다. 내일도 화이팅.';
                }
                return res.json({ message: errorM, windowClose: false });
            }

            await Gtw.createAsync(parts[1], type, date, ip, platform);

            const userInfo = await client.users.info({ user: slackuser });
            if (userInfo.ok) {
                const userEmail = userInfo.user.profile.email;
                const encryptedUserId = encrypt(`${date}|${userEmail}`);

                try {
                    const user = await User.findByEmailAsync(userEmail);
                    if (!user) {
                        console.log('User not found:', userEmail);
                        return res.status(404).json({ refreshSuccess: false, error: 'User not found' });
                    }

                    try {
                        const gtwAll = await Gtw.findByGtwAllAsync(date);
                        const myGtw = await Gtw.findByGtwAsync(user.user_id, date);

                        await publishHomeView(slackuser, user, gtwAll, myGtw, date, encryptedUserId);

                        const message =
                            type === 'gtw' || type === 'remote_gtw'
                                ? `${user.user_name}님이 ${dateNow}에 출근하셨습니다.`
                                : `${user.user_name}님이 ${dateNow}에 퇴근하셨습니다.`;

                        await sendSlackMessage('#출퇴근', message);

                        return res.json({ message: '출근완료', windowClose: true });
                    } catch (err) {
                        console.error('gtw Database query error:', err);
                        return res.status(500).json({ refreshSuccess: false, error: 'gtw Database query error' });
                    }
                } catch (err) {
                    console.error('Database query error:', err);
                    return res.status(500).json({ refreshSuccess: false, error: 'Database query error' });
                }
            } else {
                return res.status(500).send('Error fetching user info');
            }
        } catch (err) {
            console.error('Database query error:', err);
            return res.json({ message: 'Database query error', windowClose: false });
        }
    } catch (error) {
        console.error('Error in /gtwCheck route:', error);
        return res.status(400).send('Invalid user ID');
    }
});

router.post('/interactions', express.urlencoded({ extended: true }), async (req, res) => {
    const date = moment().format('YYYY-MM-DD');

    const payload = JSON.parse(req.body.payload);

    const { type, user, actions } = payload;

    if (payload.type === 'block_actions' && payload.actions[0].action_id === 'open_modal') {
        // 모달을 띄우는 함수 호출
        await openModal(payload.trigger_id);
    }
    res.status(200).send();
    //console.log(actions);
});

module.exports = router;
