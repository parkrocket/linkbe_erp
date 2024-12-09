const {
    publishHomeView,
    openModal,
    sendSlackMessage,
    updateSlackStatus,
} = require('../utils/slack');
const { encrypt, decrypt } = require('../utils/crypto');
const User = require('../models/userModel');
const Gtw = require('../models/gtwModel');
const Vca = require('../models/vacationModel');
const moment = require('moment');
const { WebClient } = require('@slack/web-api');

const { google } = require('googleapis');

const auths = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
);

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

const handleSlackEvents = async (req, res) => {
    await slackApp.requestListener()(req, res);
};

const handleHomeView = async (req, res) => {
    console.log('통신!!!');

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
                return res
                    .status(404)
                    .json({ refreshSuccess: false, error: 'User not found' });
            }

            //const gtw = await Gtw.findByGtwAllAsync(date);
            const myGtw = await Gtw.findByGtwAsync(user.user_id, date);
            const myVa = await Vca.findByAllAsync();

            await publishHomeView(
                userId,
                user,
                myGtw,
                myVa,
                date,
                encryptedUserId,
            );

            res.status(200).send();
        } catch (error) {
            console.error('Error fetching user info:', error);
            res.status(500).send('Error fetching user info');
        }
    } else {
        res.status(200).send();
    }
};

const handleGtwCheck = async (req, res) => {
    const { userId, type, platform, slackuser } = req.query;

    const date = moment().format('YYYY-MM-DD');
    const dateNow = moment().format('HH시mm분ss초');

    const location = type.includes('gtw') ? 'office' : 'home';

    let ip;
    let errorM = '';

    if (process.env.NODE_ENV === 'development') {
        ip = process.env.DEV_IP;
    } else {
        ip = req.clientIp.includes('::ffff:')
            ? req.clientIp.split('::ffff:')[1]
            : req.clientIp;
    }

    try {
        const decryptedUserId = decrypt(userId);
        const parts = decryptedUserId.split('|');

        if (date !== parts[0]) {
            return res.json({
                message: '잘못된 접근입니다.',
                windowClose: false,
            });
        }

        if (type === 'gtw' && process.env.COMPANY_IP !== ip) {
            return res.json({
                message: '지정된 ip가 아닙니다.',
                windowClose: false,
            });
        }

        console.log('퇴근버튼 누름');

        const gtw = await Gtw.findByGtwAsync(parts[1], date);
        if (type === 'gtw' && gtw.length > 0) {
            errorM =
                gtw[0].end_time === null
                    ? '이미 출근중입니다.'
                    : '이미 퇴근하셨습니다. 내일도 화이팅.';
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
                return res
                    .status(404)
                    .json({ refreshSuccess: false, error: 'User not found' });
            }

            const gtwAll = await Gtw.findByGtwAllAsync(date);
            const myGtw = await Gtw.findByGtwAsync(user.user_id, date);
            const myVa = await Vca.findByAllAsync();

            await publishHomeView(
                slackuser,
                user,
                gtwAll,
                myGtw,
                myVa,
                date,
                encryptedUserId,
            );

            const message =
                type === 'gtw' || type === 'remote_gtw'
                    ? `${user.user_name}님이 ${dateNow}에 출근하셨습니다.`
                    : `${user.user_name}님이 ${dateNow}에 퇴근하셨습니다.`;

            await sendSlackMessage('#출퇴근', message);

            const emoji =
                type === 'gtw' ? '🏢' : type === 'remote_gtw' ? '🏠' : '';
            const emojiText =
                type === 'gtw'
                    ? '회사 출근중'
                    : type === 'remote_gtw'
                    ? '재택 출근중'
                    : '';

            //await updateSlackStatus(slackuser, emoji, emojiText);

            return res.json({ message: '출근완료', windowClose: true });
        } else {
            return res.status(500).send('Error fetching user info');
        }
    } catch (error) {
        console.error('Error in /gtwCheck route:', error);
        return res.status(400).send('Invalid user ID');
    }
};

const handleInteractions = async (req, res) => {
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

        const selectedOption =
            view.state.values.input_c.select_input.selected_option.value;
        const selectedDate =
            view.state.values.input_date.datepicker_input.selected_date;

        const userInfo = await client.users.info({ user: userId });
        if (userInfo.ok) {
            const userEmail = userInfo.user.profile.email;
            const user = await User.findByEmailAsync(userEmail);

            console.log('Selected Option:', selectedOption);
            console.log('Selected Date:', selectedDate);
            console.log('UserId:', userId);

            const message =
                {
                    half: `${user.user_name}님이 ${selectedDate}에 반차를 사용하셨습니다.`,
                    day: `${user.user_name}님이 ${selectedDate}에 연차를 사용하셨습니다.`,
                    home: `${user.user_name}님이 ${selectedDate}에 재택근무를 사용하셨습니다.`,
                    vacation: `${user.user_name}님이 ${selectedDate}에 휴가를 사용하셨습니다.`,
                }[selectedOption] ||
                `${user.user_name}님이 ${selectedDate}에 알 수 없는 활동을 하셨습니다.`;

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
                const createdEvent = await calendar.events.insert({
                    calendarId: process.env.GOOGLE_CALENDAR_ID,
                    resource: event,
                });
                const eventId = createdEvent.data.id;

                await Vca.createAsync(
                    userEmail,
                    selectedOption,
                    selectedDate,
                    eventId,
                );

                return res.status(200).json({ response_action: 'clear' });
            } catch (error) {
                console.error('Error creating event:', error);
                res.status(500).send('Error creating event');
            }
        }
    }

    res.status(200).send();
};

module.exports = {
    handleSlackEvents,
    handleHomeView,
    handleGtwCheck,
    handleInteractions,
};
