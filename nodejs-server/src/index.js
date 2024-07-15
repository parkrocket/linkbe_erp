const express = require('express');
const cors = require('cors'); // CORS 미들웨어 불러오기
const dotenv = require('dotenv');
const expressSession = require('express-session');

// 환경 변수 로드
if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: '.env.production' });
} else {
    dotenv.config();
}

const app = express();

const port = 5000;

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

app.use(
    expressSession({
        secret: 'linkbe', // [필수] SID를 생성할 때 사용되는 비밀키로 String or Array 사용 가능.
        resave: true, // true(default): 변경 사항이 없어도 세션을 다시 저장, false: 변경시에만 다시 저장
        saveUninitialized: true, // true: 어떠한 데이터도 추가되거나 변경되지 않은 세션 설정 허용, false: 비허용
    })
);

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
