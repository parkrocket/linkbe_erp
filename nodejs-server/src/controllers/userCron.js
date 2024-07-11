const cron = require('node-cron');
const User = require('../models/userModel');
const db = require('../config/db');

// 기존의 사용자 관련 함수들...

// 매분 gtw_status 값을 0으로 업데이트하는 크론 작업 추가
cron.schedule('0 0 * * *', () => {
    console.log('Updating gtw_status to 0 every minute');

    const query = 'UPDATE lk_user SET gtw_status = 0, gtw_location = NULL';

    db.query(query, (error, results) => {
        if (error) {
            console.error('Error updating gtw_status:', error);
            return;
        }
        console.log('gtw_status updated successfully');
    });
});
