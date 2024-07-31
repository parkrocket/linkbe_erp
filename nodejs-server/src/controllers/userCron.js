const cron = require('node-cron');
const User = require('../models/userModel');
const pool = require('../config/dbPromise');

// 매일 오전 0시 0분에 gtw_status 값을 0으로 업데이트하는 크론 작업 추가
cron.schedule('0 0 * * *', async () => {
    console.log('Updating gtw_status to 0 every day at midnight');

    const query = 'UPDATE lk_user SET gtw_status = 0, gtw_location = NULL';

    try {
        const [results] = await pool.query(query);
        console.log('gtw_status updated successfully!');
    } catch (error) {
        console.error('Error updating gtw_status:', error);
    }
});
