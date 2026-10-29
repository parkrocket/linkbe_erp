const { WebClient } = require('@slack/web-api');
const moment = require('moment');

const token = process.env.SLACK_BOT_TOKEN; // Bot User OAuth Token을 사용
const client = new WebClient(token);
const axios = require('axios');

const sendSlackMessage = async (channel, text) => {
    try {
        await client.chat.postMessage({
            channel: channel,
            text: text,
        });
    } catch (error) {
        console.error('Error sending Slack message: ', error);
    }
};

// Slack 홈뷰 업데이트 함수
const publishHomeView = async (
    userId,
    user,
    myGtw,
    myVa,
    date,
    encryptedUserId,
) => {
    const userName = user.user_name;
    const gtwStatus = user.gtw_status;
    const gtwLocation = user.gtw_location;

    const startDate = moment(user.user_doe, 'YYYY-MM-DD');
    const startDateFormat = moment(user.user_doe).format('YYYY년 MM월 DD일');
    const today = moment();
    const workDays = today.diff(startDate, 'days');
    const formattedWorkDays = workDays.toLocaleString();

    const actionBlocks = [];

    /*
    if (gtw.length > 0) {
        const gtwText = gtw.reduce((text, entry) => {
            const locationIcon = entry.location === 'office' ? '🏢' : '🏠';
            const formattedStartTime = moment(entry.start_time).format(
                'HH시 mm분 ss초',
            );
            return `${text}${locationIcon} ${entry.user_name} : ${formattedStartTime}\n`;
        }, '근무중 / 출근시간\n\n');

        actionBlocks.push(
            { type: 'section', text: { type: 'mrkdwn', text: gtwText } },
            { type: 'divider' },
        );
    }
    */

    if (myGtw.length > 0) {
        const formattedStartTime = moment(myGtw[0].start_time).format(
            'HH시 mm분 ss초',
        );
        const formattedEndTime = myGtw[0].end_time
            ? moment(myGtw[0].end_time).format('HH시 mm분 ss초')
            : moment(myGtw[0].start_time)
                  .add(9, 'hours')
                  .format('HH시 mm분 ss초');
        const endTimeLabel = myGtw[0].end_time ? '퇴근 시간' : '퇴근 가능시간';

        actionBlocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `나의 근무 상태:\n\n출근 시간: ${formattedStartTime}\n${endTimeLabel}: ${formattedEndTime}`,
            },
        });
    }

    const addActionBlocks = () => {
        if (gtwStatus === 0) {
            actionBlocks.push(
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: '출근 옵션을 선택하세요:' },
                },
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
                },
            );
        } else if (gtwStatus === 1) {
            const url =
                gtwLocation === 'office'
                    ? `https://hibye.kr/gtw?userId=${encryptedUserId}&type=go&platform=slack&slackuser=${userId}`
                    : `https://hibye.kr/gtw?userId=${encryptedUserId}&type=remote_go&platform=slack&slackuser=${userId}`;

            actionBlocks.push(
                {
                    type: 'actions',
                    elements: [
                        {
                            type: 'button',
                            text: { type: 'plain_text', text: '퇴근하기' },
                            url,
                            action_id: 'clock_out',
                        },
                    ],
                },
                { type: 'divider' },
            );
        } else if (gtwStatus === 2) {
            actionBlocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: '오늘 하루 수고하셨습니다!' },
            });
        }

        actionBlocks.push(
            {
                type: 'section',
                text: { type: 'mrkdwn', text: '🏖️ 휴가 및 연차신청' },
            },
            {
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
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: '관리창가기',
                            emoji: true,
                        },
                        url: `https://hibye.kr/vaca`,
                        action_id: 'page_go',
                    },
                ],
            },
        );

        if (myVa.length > 0) {
            const myVaText = myVa.reduce((text, entry) => {
                const typeText = {
                    home: '재택',
                    half: '반차',
                    day: '연차',
                    vacation: '휴가',
                }[entry.type];

                const formattedDate = moment(entry.date).format(
                    'YYYY년 MM월 DD일',
                );
                //const formattedVaDatetime = moment(entry.va_datetime).format('YYYY년 MM월 DD일');

                return `${text} ${entry.user_name} ${typeText} - ${formattedDate}\n`;
            }, '팀원 휴가 및 연차 내역:\n\n');

            actionBlocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: myVaText },
            });
        }

        actionBlocks.push(
            { type: 'divider' },
            { type: 'section', text: { type: 'mrkdwn', text: '📰 나의 정보' } },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `나의 입사일 : ${startDateFormat} \n 나의 남은연차 : ${user.user_stip}일 \n 나의 남은휴가 : ${user.user_vaca}일 \n 나의 총 근로일 : ${formattedWorkDays}일`,
                },
            },
            { type: 'divider' },
        );
    };

    addActionBlocks();

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
        { type: 'divider' },
        ...actionBlocks,
    ];

    try {
        await client.views.publish({
            user_id: userId,
            view: { type: 'home', callback_id: 'home_view', blocks },
        });
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
            options.push({
                text: { type: 'plain_text', text: '반차' },
                value: 'half',
            });
        }

        if (user.user_stip >= 1) {
            options.push({
                text: { type: 'plain_text', text: '연차' },
                value: 'day',
            });
        }

        if (user.user_vaca >= 1) {
            options.push({
                text: { type: 'plain_text', text: '휴가' },
                value: 'vacation',
            });
        }

        await client.views.open({
            trigger_id,
            view: {
                type: 'modal',
                callback_id: 'modal-identifier',
                title: { type: 'plain_text', text: '휴가 및 연차신청' },
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: '휴가 및 연차를 신청해주세요.',
                        },
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'plain_text',
                                text: `나의 남은 연차갯수 : ${user.user_stip} \n 나의 남은 휴가갯수 : ${user.user_vaca}`,
                                emoji: true,
                            },
                        ],
                    },
                    // 신청 규칙 안내 — 서버(applyModel)가 같은 규칙으로 검사
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'mrkdwn',
                                text: '재택은 한 달에 최대 2회 · 주말·지난 날짜·이미 신청한 날은 신청할 수 없어요.',
                            },
                        ],
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
                            options,
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
                submit: { type: 'plain_text', text: '제출' },
            },
        });
    } catch (error) {
        console.error('Error opening modal:', error);
    }
};

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
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            },
        );

        console.log(userId, token);

        if (!response.data.ok) {
            throw new Error(`Error updating status: ${response.data.error}`);
        }
    } catch (error) {
        console.error('Error updating status:', error);
        throw error;
    }
};

module.exports = {
    sendSlackMessage,
    publishHomeView,
    openModal,
    updateSlackStatus,
};
