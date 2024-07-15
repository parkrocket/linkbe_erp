const express = require('express');
const User = require('../models/userModel');
const Gtw = require('../models/gtwModel');
const Vca = require('../models/vacationModel');
const moment = require('moment');
const router = express.Router();
const slackApp = require('../utils/slack');
const { WebClient } = require('@slack/web-api');
const requestIp = require('request-ip');
const crypto = require('crypto');
const { sendSlackMessage } = require('../utils/slack');
const { google } = require('googleapis');

const algorithm = 'aes-256-cbc';
const secretKey = 'linkbeflatformlinkbeflatformlink'; // 32바이트 키
const ivLength = 16; // AES 블록 크기

const oAuth2Client = new google.auth.OAuth2(process.env.GOOGLE_C_ID, process.env.GOOGLE_S_ID, process.env.GOOGLE_CALLBACK_URL);

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

function checkToken(req, res, next) {
    if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        oAuth2Client.setCredentials(token);

        // 토큰 유효성 검사
        oAuth2Client.getAccessToken((err, token) => {
            if (err || !token) {
                console.log('No valid token found, redirecting to auth');
                return res.redirect('/api/slack/auth');
            }
            next();
        });
    } else {
        console.log('No token found, redirecting to auth');
        return res.redirect('/api/slack/auth');
    }
}

// 인증 URL 생성 (최초 인증을 위해 한번 수행)
router.get('/auth', (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar'],
    });
    res.redirect(authUrl);
});

// 인증 후 토큰 저장
router.get('/oauth2callback', (req, res) => {
    console.log(req.query.code);

    const code = req.query.code;
    oAuth2Client.getToken(code, async (err, token) => {
        if (err) return res.status(400).send('Error retrieving access token');
        oAuth2Client.setCredentials(token);

        // 토큰을 안전한 곳에 저장하세요 (예: 데이터베이스)
        res.send('Authentication successful! You can close this tab.');
    });
});

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
    actionBlocks.push({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: '🏖️ 휴가 및 연차신청',
        },
    });

    actionBlocks.push({
        type: 'actions',
        elements: [
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
    });

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
                            text: '휴가 및 연차 선택하세요',
                        },
                        element: {
                            type: 'static_select',
                            action_id: 'select_input',
                            placeholder: {
                                type: 'plain_text',
                                text: '휴가 및 연차 선택하세요',
                            },
                            options: [
                                {
                                    text: {
                                        type: 'plain_text',
                                        text: '재택',
                                    },
                                    value: 'home',
                                },
                                {
                                    text: {
                                        type: 'plain_text',
                                        text: '반차',
                                    },
                                    value: 'half',
                                },
                                {
                                    text: {
                                        type: 'plain_text',
                                        text: '연차',
                                    },
                                    value: 'day',
                                },
                                {
                                    text: {
                                        type: 'plain_text',
                                        text: '휴가',
                                    },
                                    value: 'vacation',
                                },
                            ],
                        },
                    },
                    {
                        type: 'input',
                        block_id: 'input_date',
                        label: {
                            type: 'plain_text',
                            text: '날짜를 선택하세요',
                        },
                        element: {
                            type: 'datepicker',
                            action_id: 'datepicker_input',
                            placeholder: {
                                type: 'plain_text',
                                text: '날짜 선택',
                            },
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

    if (payload.type === 'view_submission') {
        const { user, view } = payload;
        const userId = user.id;

        // 모달에서 제출된 값들 가져오기
        const selectedOption = view.state.values.input_c.select_input.selected_option.value;
        const selectedDate = view.state.values.input_date.datepicker_input.selected_date;

        const userInfo = await client.users.info({ user: userId });
        if (userInfo.ok) {
            const userEmail = userInfo.user.profile.email;

            const user = await User.findByEmailAsync(userEmail);

            console.log('Selected Option:', selectedOption);
            console.log('Selected Date:', selectedDate);
            console.log('UserId:', userId);

            const vacation = await Vca.createAsync(userEmail, selectedOption, selectedDate);

            const message =
                selectedOption === 'half'
                    ? `${user.user_name}님이 ${selectedDate}에 반차를 사용하셨습니다.`
                    : selectedOption === 'day'
                    ? `${user.user_name}님이 ${selectedDate}에 연차를 사용하셨습니다.`
                    : selectedOption === 'home'
                    ? `${user.user_name}님이 ${selectedDate}에 재택근무를 사용하셨습니다.`
                    : selectedOption === 'vacation'
                    ? `${user.user_name}님이 ${selectedDate}에 휴가를 사용하셨습니다.`
                    : `${user.user_name}님이 ${selectedDate}에 알 수 없는 활동을 하셨습니다.`;

            await sendSlackMessage('#출퇴근', message);

            const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

            const event = {
                summary: `${user.user_name}님이 ${selectedOption} 사용.`,
                description: message,
                start: {
                    date: selectedDate,
                    timeZone: 'Asia/Seoul',
                },
                end: {
                    date: selectedDate,
                    timeZone: 'Asia/Seoul',
                },
            };

            calendar.events.insert(
                {
                    auth: oAuth2Client,
                    calendarId: process.env.GOOGLE_CALENDAR_ID, // '링크비 휴가 캘린더'의 ID로 교체하세요
                    resource: event,
                },
                (err, event) => {
                    if (err) {
                        console.log('There was an error contacting the Calendar service: ' + err);
                        return;
                    }
                    console.log('Event created: %s', event.htmlLink);
                }
            );
        }

        // 필요한 데이터 처리 로직 추가
        // 예: DB에 저장, Slack 메시지 보내기 등

        return res.status(200).json({ response_action: 'clear' });
    }

    res.status(200).send();
    //console.log(actions);
});

module.exports = router;
