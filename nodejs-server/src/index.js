const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const cors = require('cors'); // CORS 미들웨어 불러오기
const dotenv = require('dotenv');


// 환경 변수 로드
if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: '.env.production' });
} else {
    dotenv.config();
}

const app = express();

const port = 5000;

const receiver = new ExpressReceiver({ signingSecret: process.env.SLACK_SIGNING_SECRET });

const slackApp = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver,
});


// 액션 핸들러 등록
slackApp.action('select_input', async ({ ack, body, client }) => {

    console.log("asdf");

    await ack();

    const selectedOption = body.actions[0].selected_option.value;
    let blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: '휴가 및 연차를 신청해주세요.' } },
        {
            type: 'context',
            elements: [{ type: 'plain_text', text: `나의 남은 연차갯수 : ${body.user.user_stip} \n 나의 남은 휴가갯수 : ${body.user.user_vaca}`, emoji: true }],
        },
        {
            type: 'input',
            block_id: 'input_c',
            label: { type: 'plain_text', text: '휴가 및 연차 선택하세요' },
            element: {
                type: 'static_select',
                action_id: 'select_input',
                placeholder: { type: 'plain_text', text: '휴가 및 연차 선택하세요' },
                options: [
                    { text: { type: 'plain_text', text: '재택' }, value: 'home' },
                    { text: { type: 'plain_text', text: '반차' }, value: 'half' },
                    { text: { type: 'plain_text', text: '연차' }, value: 'day' },
                    { text: { type: 'plain_text', text: '휴가' }, value: 'vacation' },
                ],
            },
        },
    ];

    if (selectedOption === 'vacation') {
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

    await client.views.update({
        view_id: body.view.id,
        hash: body.view.hash,
        view: {
            type: 'modal',
            callback_id: 'modal-identifier',
            title: { type: 'plain_text', text: '휴가 및 연차신청' },
            blocks,
            submit: { type: 'plain_text', text: '제출' },
        },
    });
});


const requestIp = require('request-ip');

app.use(cors()); // CORS 미들웨어 사용

// 매분마다 실행
require('./controllers/userCron.js');

app.use(requestIp.mw());

// 환경 변수 로드
if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: '.env.production' });
} else {
    dotenv.config();
}

// CORS 설정

// JSON 요청을 파싱하는 미들웨어
app.use(express.json());

// 라우터 설정

const listRoutes = require('./routes/list');
const userRoutes = require('./routes/user');
const gtwRoutes = require('./routes/gtw');
const companyRoutes = require('./routes/company');
const slackRoutes = require('./routes/slack');

app.use('/api/users', userRoutes);

app.use('/api/gtw', gtwRoutes);

app.use('/api/list', listRoutes);

app.use('/api/company', companyRoutes);

app.use('/api/slack', slackRoutes);

// /api/test 경로 추가
app.get('/api/test', (req, res) => {
    console.log('Received a request on /api/test');
    res.send('This is a test endpoint');
});

// 서버 실행
app.listen(port, () => {
    console.log(`Server running on  port ${port}`);
});
