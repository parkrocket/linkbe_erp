const express = require('express');
const cors = require('cors'); // CORS 미들웨어 불러오기
const mysql = require('mysql2');
const dotenv = require('dotenv');
const app = express();
const port = 5000;

// 환경 변수 로드
dotenv.config();

// CORS 설정
app.use(cors()); // CORS 미들웨어 사용

// JSON 요청을 파싱하는 미들웨어
app.use(express.json());

// MySQL 연결 설정
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

// MySQL 연결
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// API 엔드포인트 정의
app.get('/api/hello', (req, res) => {
    db.query('SELECT "Hello from MySQL!" AS message', (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: 'Database query error' });
            return;
        }
        res.json({ message: results[0].message });
    });
});

// 서버 실행
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
