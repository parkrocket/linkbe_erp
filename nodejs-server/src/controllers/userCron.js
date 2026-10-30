const cron = require('node-cron');
const User = require('../models/userModel');
const pool = require('../config/dbPromise');

// 매일 오전 0시 0분에 gtw_status 값을 0으로 업데이트하는 크론 작업 추가
cron.schedule('0 0 * * *', async () => {
    console.log('Updating gtw_status to 0 every day at midnight');

    const query = 'UPDATE lk_user SET gtw_status = 0, gtw_location = NULL';

    try {
        const [results] = await pool.query(query);
        console.log('gtw_status updated successfully!!');
    } catch (error) {
        console.error('Error updating gtw_status:', error);
    }
});

// 신입 월차 자동 부여 — 매달 1일 00:05 한국 시간 (서버 시계는 UTC라 timezone 지정)
// 실패는 로그만 (서버가 죽지 않게), 부여 후 #hibye-관리 요약
const MonthlyGrant = require('../models/monthlyGrant');
const { kstToday } = require('../utils/profileValidation');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

const grantMonthly = async (today = kstToday()) => {
    try {
        const result = await MonthlyGrant.run(today);
        await MonthlyGrant.notify(result);
        if (result.granted.length) console.log(`monthly grant ${result.month}: ${result.granted.length}명`);
    } catch (error) {
        console.error('monthly grant failed:', error.message);
        // 조용히 실패하면 그 달 부여가 누락돼도 아무도 모름 — 관리 채널에 알림 (알림 실패는 무시)
        await slack
            .sendSlackMessage('#hibye-관리', `⚠️ ${today.slice(0, 7)} 월차 자동 부여에 실패했어요. 서버 로그를 확인해 주세요.`)
            .catch(() => {});
    }
};

// 시작 시 보충: 1~3일에만 이번 달 몫 (1일에 서버가 꺼져 있던 경우). 월 중간 배포·재시작으로 그 달 몫이
// 갑자기 부여되면 도입 전 수동 부여와 겹칠 수 있어 제한. 지난 달 소급 없음, 중복은 장부로 방지
const CATCH_UP_DAYS = 3;
const catchUp = async (today = kstToday()) => {
    if (Number(today.slice(8, 10)) <= CATCH_UP_DAYS) await grantMonthly(today);
};

cron.schedule('5 0 1 * *', () => grantMonthly(), { timezone: 'Asia/Seoul' });
catchUp();

module.exports = { grantMonthly, catchUp };
