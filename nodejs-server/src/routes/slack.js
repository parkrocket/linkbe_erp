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
const axios = require('axios');

const algorithm = 'aes-256-cbc';
const secretKey = 'linkbeflatformlinkbeflatformlink'; // 32바이트 키
const ivLength = 16; // AES 블록 크기

const auths = new google.auth.JWT(process.env.GOOGLE_CLIENT_EMAIL, null, process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), [
    'https://www.googleapis.com/auth/calendar',
]);

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

// Slack 홈뷰 업데이트 함수
const publishHomeView = async (userId, user, gtw, myGtw, myVa, date, encryptedUserId) => {
    const userName = user.user_name;
    const gtwStatus = user.gtw_status;
    const gtwLocation = user.gtw_location;

    const startDate = moment(user.user_doe, 'YYYY-MM-DD');
    const startDateFormat = moment(user.user_doe).format('YYYY년 MM월 DD일');
    const today = moment();
    const workDays = today.diff(startDate, 'days');
    const formattedWorkDays = workDays.toLocaleString();

    const actionBlocks = [];

    if (gtw.length > 0) {
        const gtwText = gtw.reduce((text, entry) => {
            const locationIcon = entry.location === 'office' ? '🏢' : '🏠';
            const formattedStartTime = moment(entry.start_time).format('HH시 mm분 ss초');
            return `${text}${locationIcon} ${entry.user_name} : ${formattedStartTime}\n`;
        }, '근무중 / 출근시간\n\n');

        actionBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: gtwText } }, { type: 'divider' });
    }

    if (myGtw.length > 0) {
        const formattedStartTime = moment(myGtw[0].start_time).format('HH시 mm분 ss초');
        const formattedEndTime = myGtw[0].end_time
            ? moment(myGtw[0].end_time).format('HH시 mm분 ss초')
            : moment(myGtw[0].start_time).add(9, 'hours').format('HH시 mm분 ss초');
        const endTimeLabel = myGtw[0].end_time ? '퇴근 시간' : '퇴근 가능시간';

        actionBlocks.push(
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `나의 근무 상태:\n\n출근 시간: ${formattedStartTime}\n${endTimeLabel}: ${formattedEndTime}` },
            },
        );
    }

    const addActionBlocks = () => {
        if (gtwStatus === 0) {
            actionBlocks.push(
                { type: 'section', text: { type: 'mrkdwn', text: '출근 옵션을 선택하세요:' } },
                {
                    type: 'actions',
                    elements: [
                        {
                            type: 'button',
                            text: { type: 'plain_text', text: '출근하기' },
                            url: `https://hibye.kr/gtw?userId=${encryptedUserId}&type=gtw&platform=slack&slackuser=${userId}`,
                            action_id: 'clock_in',
                        },
                        {
                            type: 'button',
                            text: { type: 'plain_text', text: '재택출근하기' },
                            url: `https://hibye.kr/gtw?userId=${encryptedUserId}&type=remote_gtw&platform=slack&slackuser=${userId}`,
                            action_id: 'remote_clock_in',
                        },
                    ],
                }
            );
        } else if (gtwStatus === 1) {
            const url =
                gtwLocation === 'office'
                    ? `https://hibye.kr/gtw?userId=${encryptedUserId}&type=go&platform=slack&slackuser=${userId}`
                    : `https://hibye.kr/gtw?userId=${encryptedUserId}&type=remote_go&platform=slack&slackuser=${userId}`;

            actionBlocks.push(
                
                {
                    type: 'actions',
                    elements: [{ type: 'button', text: { type: 'plain_text', text: '퇴근하기' }, url, action_id: 'clock_out' }],
                },
                { type: 'divider' }
            );
        } else if (gtwStatus === 2) {
            actionBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: '오늘 하루 수고하셨습니다!' } });
        }

        actionBlocks.push(
            { type: 'section', text: { type: 'mrkdwn', text: '🏖️ 휴가 및 연차신청' } },
            {
                type: 'actions',
                elements: [{ type: 'button', text: { type: 'plain_text', text: '신청하기', emoji: true }, action_id: 'open_modal' }],
            });

            if (myVa.length > 0) {
                const myVaText = myVa.reduce((text, entry) => {
                    const typeText = {
                        home: '재택',
                        half: '반차',
                        day: '연차',
                        vacation: '휴가'
                    }[entry.type];
    
                    const formattedDate = moment(entry.date).format('YYYY년 MM월 DD일');
                    //const formattedVaDatetime = moment(entry.va_datetime).format('YYYY년 MM월 DD일');
    
                    return `${text} ${entry.user_name} ${typeText} - ${formattedDate}\n`;
                }, '팀원 휴가 및 연차 내역:\n\n');
    
                actionBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: myVaText } });
            }    

        actionBlocks.push({ type: 'divider' },
            { type: 'section', text: { type: 'mrkdwn', text: '📰 나의 정보' } },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `나의 입사일 : ${startDateFormat} \n 나의 남은연차 : ${user.user_stip}일 \n 나의 남은휴가 : ${user.user_vaca}일 \n 나의 총 근로일 : ${formattedWorkDays}일`,
                },
            },
            { type: 'divider' }
        );
       
      
        
          
    };

    addActionBlocks();

    const blocks = [
        {
            type: 'context',
            elements: [{ type: 'plain_text', text: `🎉 ${date}일 입니다. ${userName}님!`, emoji: true }],
        },
        { type: 'divider' },
        ...actionBlocks,
    ];

    try {
        await client.views.publish({ user_id: userId, view: { type: 'home', callback_id: 'home_view', blocks } });
    } catch (error) {
        console.error('Error publishing view:', error);
    }
};

// 모달을 띄우는 함수
const openModal = async (trigger_id, user) => {
    try {
        const options = [
            { text: { type: 'plain_text', text: '재택' }, value: 'home' },
        ];

        if (user.user_stip >= 0.5) {
            options.push({ text: { type: 'plain_text', text: '반차' }, value: 'half' });
        }
        
        if (user.user_stip >= 1) {
            options.push({ text: { type: 'plain_text', text: '연차' }, value: 'day' });
        }
        
        if (user.user_vaca >= 1) {
            options.push({ text: { type: 'plain_text', text: '휴가' }, value: 'vacation' });
        }
        
        const blocks = [
            { type: 'section', text: { type: 'mrkdwn', text: '휴가 및 연차를 신청해주세요.' } },
            {
                type: 'context',
                elements: [{ type: 'plain_text', text: `나의 남은 연차갯수 : ${user.user_stip} \n 나의 남은 휴가갯수 : ${user.user_vaca}`, emoji: true }],
            },
            {
                type: 'input',
                block_id: 'input_c',
                label: { type: 'plain_text', text: '휴가 및 연차 선택하세요' },
                element: {
                    type: 'static_select',
                    action_id: 'select_input',
                    placeholder: { type: 'plain_text', text: '휴가 및 연차 선택하세요' },
                    options,
                },
            },
        ];

        if (options.some(option => option.value === 'vacation')) {
            blocks.push(
                {
                    type: 'input',
                    block_id: 'input_start_date',
                    label: { type: 'plain_text', text: '휴가 시작일을 선택하세요' },
                    element: {
                        type: 'datepicker',
                        action_id: 'start_datepicker_input',
                        placeholder: { type: 'plain_text', text: '시작일 선택' },
                    },
                },
                {
                    type: 'input',
                    block_id: 'input_end_date',
                    label: { type: 'plain_text', text: '휴가 종료일을 선택하세요' },
                    element: {
                        type: 'datepicker',
                        action_id: 'end_datepicker_input',
                        placeholder: { type: 'plain_text', text: '종료일 선택' },
                    },
                }
            );
        } else {
            blocks.push({
                type: 'input',
                block_id: 'input_date',
                label: { type: 'plain_text', text: '날짜를 선택하세요' },
                element: {
                    type: 'datepicker',
                    action_id: 'datepicker_input',
                    placeholder: { type: 'plain_text', text: '날짜 선택' },
                },
            });
        }

        await client.views.open({
            trigger_id,
            view: {
                type: 'modal',
                callback_id: 'modal-identifier',
                title: { type: 'plain_text', text: '휴가 및 연차신청' },
                blocks,
                submit: { type: 'plain_text', text: '제출' },
            },
        });
    } catch (error) {
        console.error('Error opening modal:', error);
    }
};

// Slack 이벤트 핸들러
router.post('/events', async (req, res) => {
    await slackApp.requestListener()(req, res);
});

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
            const myVa = await Vca.findByAllAsync();



            await publishHomeView(userId, user, gtw, myGtw,myVa, date, encryptedUserId);

            res.status(200).send();
        } catch (error) {
            console.error('Error fetching user info:', error);
            res.status(500).send('Error fetching user info');
        }
    } else {
        res.status(200).send();
    }
});

// 출퇴근 체크 핸들러
router.get('/gtwCheck', async (req, res) => {
    const { userId, type, platform, slackuser } = req.query;
    const date = moment().format('YYYY-MM-DD');
    const dateNow = moment().format('HH시mm분ss초');

    const location = type.includes('gtw') ? 'office' : 'home';

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
            return res.json({ message: '지정된 ip가 아닙니다.', windowClose: false });
        }

        const gtw = await Gtw.findByGtwAsync(parts[1], date);
        if (type === 'gtw' && gtw.length > 0) {
            errorM = gtw[0].end_time === null ? '이미 출근중입니다.' : '이미 퇴근하셨습니다. 내일도 화이팅.';
            return res.json({ message: errorM, windowClose: false });
        }

        await Gtw.createAsync(parts[1], type, date, ip, platform);

        const userInfo = await client.users.info({ user: slackuser });
        if (userInfo.ok) {
            const userEmail = userInfo.user.profile.email;
            const encryptedUserId = encrypt(`${date}|${userEmail}`);

            const user = await User.findByEmailAsync(userEmail);
            if (!user) {
                console.log('User not found:', userEmail);
                return res.status(404).json({ refreshSuccess: false, error: 'User not found' });
            }

            const gtwAll = await Gtw.findByGtwAllAsync(date);
            const myGtw = await Gtw.findByGtwAsync(user.user_id, date);
            const myVa = await Vca.findByAllAsync();

            await publishHomeView(slackuser, user, gtwAll, myGtw,myVa, date, encryptedUserId);

            const message =
                type === 'gtw' || type === 'remote_gtw'
                    ? `${user.user_name}님이 ${dateNow}에 출근하셨습니다.`
                    : `${user.user_name}님이 ${dateNow}에 퇴근하셨습니다.`;

            await sendSlackMessage('#출퇴근', message);

            const emoji = type === 'gtw' ? '🏢' : type === 'remote_gtw' ? '🏠' : '';
            const emojiText = type === 'gtw' ? '회사 출근중' : type === 'remote_gtw' ? '재택 출근중' : '';

            await updateSlackStatus(slackuser, emoji, emojiText);

            return res.json({ message: '출근완료', windowClose: true });
        } else {
            return res.status(500).send('Error fetching user info');
        }
    } catch (error) {
        console.error('Error in /gtwCheck route:', error);
        return res.status(400).send('Invalid user ID');
    }
});

// 인터랙션 핸들러
router.post('/interactions', express.urlencoded({ extended: true }), async (req, res) => {
    const date = moment().format('YYYY-MM-DD');
    const payload = JSON.parse(req.body.payload);
    const { type, user, actions } = payload;

    if (type === 'block_actions' && actions[0].action_id === 'open_modal') {
        const { user } = payload;
        const userId = user.id;
        const userInfo = await client.users.info({ user: userId });
        if (userInfo.ok) {
            const userEmail = userInfo.user.profile.email;
            const user = await User.findByEmailAsync(userEmail);

            await openModal(payload.trigger_id, user);
        }
    }

    if (type === 'view_submission') {
        const { user, view } = payload;
        const userId = user.id;

        const selectedOption = view.state.values.input_c.select_input.selected_option.value;
        const selectedDate = view.state.values.input_date.datepicker_input.selected_date;

        const userInfo = await client.users.info({ user: userId });
        if (userInfo.ok) {
            const userEmail = userInfo.user.profile.email;
            const user = await User.findByEmailAsync(userEmail);

            console.log('Selected Option:', selectedOption);
            console.log('Selected Date:', selectedDate);
            console.log('UserId:', userId);

            await Vca.createAsync(userEmail, selectedOption, selectedDate);

            const message =
                {
                    half: `${user.user_name}님이 ${selectedDate}에 반차를 사용하셨습니다.`,
                    day: `${user.user_name}님이 ${selectedDate}에 연차를 사용하셨습니다.`,
                    home: `${user.user_name}님이 ${selectedDate}에 재택근무를 사용하셨습니다.`,
                    vacation: `${user.user_name}님이 ${selectedDate}에 휴가를 사용하셨습니다.`,
                }[selectedOption] || `${user.user_name}님이 ${selectedDate}에 알 수 없는 활동을 하셨습니다.`;

            const vacaType =
                {
                    half: '반차',
                    day: '연차',
                    home: '재택',
                    vacation: '휴가',
                }[selectedOption] || '알수없음';

            const stip =
                {
                    half: 0.5,
                    day: 1,
                    home: 0,
                    vacation: 1,
                }[selectedOption] || 0;

            await User.stipUpdateAsync(userEmail, stip, selectedOption);
            await sendSlackMessage('#출퇴근', message);

            const calendar = google.calendar({ version: 'v3', auth: auths });
            const event = {
                summary: `[${user.user_name}] ${vacaType}`,
                description: message,
                start: { date: selectedDate, timeZone: 'Asia/Seoul' },
                end: { date: selectedDate, timeZone: 'Asia/Seoul' },
            };

            try {
                await calendar.events.insert({ calendarId: process.env.GOOGLE_CALENDAR_ID, resource: event });
                return res.status(200).json({ response_action: 'clear' });
            } catch (error) {
                console.error('Error creating event:', error);
                res.status(500).send('Error creating event');
            }
        }
    }

    res.status(200).send();
});

const updateSlackStatus = async (userId, emoji, text) => {
    const token = process.env.SLACK_USER_TOKEN;
    const url = 'https://slack.com/api/users.profile.set';

    const profile = {
        status_text: text,
        status_emoji: emoji,
        status_expiration: 0,
    };

    try {
        const response = await axios.post(
            url,
            { profile: JSON.stringify(profile), user: userId },
            { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
        );
        if (!response.data.ok) {
            throw new Error(`Error updating status: ${response.data.error}`);
        }
    } catch (error) {
        console.error('Error updating status:', error);
        throw error;
    }
};

module.exports = router;
