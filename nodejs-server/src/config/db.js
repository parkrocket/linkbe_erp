const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
};

let connection;

function handleDisconnect() {
    connection = mysql.createConnection(dbConfig);

    connection.connect((err) => {
        if (err) {
            console.error('! Error connecting to MySQL:', err);
            setTimeout(handleDisconnect, 2000); // 2초 후에 다시 시도
        } else {
            console.log('Connected to MySQL');
        }
    });

    connection.on('error', (err) => {
        console.error('MySQL error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect(); // 연결이 끊어졌을 때 재연결 시도
        } else {
            throw err;
        }
    });
}

handleDisconnect();

module.exports = connection;