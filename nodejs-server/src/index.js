const express = require('express');
const cors = require('cors'); // CORS 미들웨어 불러오기
const app = express();
const port = 5000;

// CORS 설정
app.use(cors()); // CORS 미들웨어 사용

// JSON 요청을 파싱하는 미들웨어
app.use(express.json());

// API 엔드포인트 정의
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from Node.js!!!' });
});

// 서버 실행
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
