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
const Apply = require('../models/applyModel');
const { escapeSlack } = require('../utils/slackEscape');
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

// 근태 신청 오류 → Slack 모달 블록별 안내 (input_c: 종류 선택, input_date: 날짜) — 문구는 웹과 동일
const SLACK_LEAVE_ERRORS = {
    'Monthly home limit exceeded': ['input_date', '재택은 한 달에 최대 2회까지 신청할 수 있어요.'],
    'Insufficient balance': ['input_c', '남은 일수가 부족해요.'],
    'Already applied on this date': ['input_date', '이미 근태를 신청한 날짜예요. 한 날짜에 하나만 신청할 수 있어요.'],
    'Weekend not allowed': ['input_date', '주말은 신청할 수 없어요.'],
    'Past date not allowed': ['input_date', '오늘 이전 날짜는 신청할 수 없어요.'],
    'Invalid leave type': ['input_c', '근태 종류를 다시 선택해 주세요.'],
    'Invalid date': ['input_date', '날짜를 다시 선택해 주세요.'],
    'User not found': ['input_c', 'Slack 이메일과 같은 hibye 계정이 없어요. 관리자에게 문의해 주세요.'],
    'Account not approved': ['input_c', '승인된 계정만 근태를 신청할 수 있어요. 관리자에게 문의해 주세요.'],
};
const slackLeaveError = error => {
    const [block, text] = SLACK_LEAVE_ERRORS[error.message] || ['input_date', '신청하지 못했어요. 잠시 후 다시 시도해 주세요.'];
    return { [block]: text };
};

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

        /*

        if (type === 'gtw' && process.env.COMPANY_IP !== ip) {
            return res.json({
                message: '지정된 ip가 아닙니다.',
                windowClose: false,
            });
        }
            */

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

            // 웹과 같은 규칙(잔여·중복·재택 월 2회·주말·지난 날짜)으로 신청 — 실패하면 모달에 이유 표시
            // (기존: 검사 없이 차감 → 알림 → 캘린더 순서라 실패해도 차감·알림이 남았음)
            try {
                await Apply.insertMany({ userId: userEmail, dates: [selectedDate], type: selectedOption });
            } catch (error) {
                if (!error.status || error.status >= 500) console.error('slack leave apply error:', error.message);
                return res.status(200).json({ response_action: 'errors', errors: slackLeaveError(error) });
            }

            const user = await User.findByEmailAsync(userEmail);
            const message =
                {
                    half: `${escapeSlack(user.user_name)}님이 ${selectedDate}에 반차를 사용하셨습니다.`,
                    day: `${escapeSlack(user.user_name)}님이 ${selectedDate}에 연차를 사용하셨습니다.`,
                    home: `${escapeSlack(user.user_name)}님이 ${selectedDate}에 재택근무를 사용하셨습니다.`,
                    vacation: `${escapeSlack(user.user_name)}님이 ${selectedDate}에 휴가를 사용하셨습니다.`,
                }[selectedOption] ||
                `${escapeSlack(user.user_name)}님이 ${selectedDate}에 알 수 없는 활동을 하셨습니다.`;

            // 알림은 신청이 성공한 뒤에만 (알림 실패가 신청 결과를 바꾸지 않도록 기록만)
            await sendSlackMessage('#출퇴근', message).catch(e => console.error('slack notify failed:', e.message));
            return res.status(200).json({ response_action: 'clear' });
        }
        return res.status(200).json({
            response_action: 'errors',
            errors: { input_c: 'Slack 사용자 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' },
        });
    }

    res.status(200).send();
};

module.exports = {
    handleSlackEvents,
    handleHomeView,
    handleGtwCheck,
    handleInteractions,
};
