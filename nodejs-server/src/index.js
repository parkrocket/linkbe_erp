const express = require('express');
const cors = require('cors'); // CORS 미들웨어 불러오기
const dotenv = require('dotenv');
const app = express();
const port = 5000;

// 환경 변수 로드
dotenv.config();

// CORS 설정
app.use(cors()); // CORS 미들웨어 사용

// JSON 요청을 파싱하는 미들웨어
app.use(express.json());

// 라우터 설정
const userRoutes = require('./routes/user');
app.use('/api/users', userRoutes);

// 서버 실행
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
