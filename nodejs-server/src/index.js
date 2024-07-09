const express = require('express');
const cors = require('cors'); // CORS 미들웨어 불러오기
const dotenv = require('dotenv');
const app = express();
const { WebClient } = require('@slack/web-api');

const port = 5000;

const token = process.env.SLACK_BOT_TOKEN;
const client = new WebClient(token);

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

app.use('/api/users', userRoutes);

app.use('/api/gtw', gtwRoutes);

app.use('/api/list', listRoutes);

app.use('/api/company', companyRoutes);

// /api/test 경로 추가
app.get('/api/test', (req, res) => {
    console.log('Received a request on /api/test');
    res.send('This is a test endpoint');
});

app.post('/slack/events', async (req, res) => {
    const { type, challenge, event } = req.body;

    if (type === 'url_verification') {
        // Respond with the challenge parameter
        res.status(200).send({ challenge: challenge });
    } else if (type === 'event_callback' && event.type === 'app_home_opened') {
        const userId = event.user;

        // Block Kit structure for home tab
        const view = {
            type: 'home',
            callback_id: 'home_view',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: "Welcome to your _App's Home_!",
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
                {
                    type: 'image',
                    image_url: 'https://www.example.com/cool-image.png',
                    alt_text: 'cool image',
                },
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
    } else {
        res.status(200).send();
    }
});

// 서버 실행
app.listen(port, () => {
    console.log(`Server running on  port ${port}`);
});
