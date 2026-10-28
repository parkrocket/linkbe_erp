const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// 단일 연결은 MySQL wait_timeout으로 끊기면(4031) 프로세스가 죽음 → pool로 교체
// pool은 끊긴 연결을 버리고 새로 만들어주므로 재연결 로직이 필요 없음
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT, // 미설정 시 기본 3306 (로컬은 SSH 터널 포트 사용)
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
});

module.exports = pool;
