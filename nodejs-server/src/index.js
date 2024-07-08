const express = require('express');
const cors = require('cors'); // CORS 미들웨어 불러오기
const dotenv = require('dotenv');
const app = express();

const port = 5000;

const requestIp = require('request-ip');

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
app.use(cors()); // CORS 미들웨어 사용

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

// 서버 실행
app.listen(port, () => {
    console.log(`Server running on  port! ${port}`);
});
