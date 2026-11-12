const cron = require('node-cron');
const Holiday = require('../models/holidayModel');
const { kstToday } = require('../utils/profileValidation');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

// 공휴일 갱신 — 올해 + 내년 치를 특일정보 API에서 받아 lk_holiday 교체
// 실패·올해 0건이면 기존 데이터를 그대로 두고 #hibye-관리 알림 (조용히 실패하면 임시공휴일이 반영 안 된 걸 아무도 모름)
const syncHolidays = async (today = kstToday()) => {
    const year = Number(today.slice(0, 4));
    try {
        const count = await Holiday.sync(year);
        if (!count) throw new Error('empty response');
        // 내년 치는 아직 없을 수 있음 — 0건·실패는 로그만
        const next = await Holiday.sync(year + 1).catch(error => (console.error('holiday sync (next year) failed:', error.message), 0));
        return { [year]: count, [year + 1]: next };
    } catch (error) {
        console.error('holiday sync failed:', error.message);
        await slack.sendSlackMessage('#hibye-관리', '⚠️ 공휴일 갱신에 실패했어요. 기존 공휴일은 그대로예요. 서버 로그를 확인해 주세요.').catch(() => {});
        return null;
    }
};

// 매일 04:00 한국 시간 (서버 시계는 UTC라 timezone 지정) + 서버 시작 시 1회(첫 배포·크론 누락 보충)
cron.schedule('0 4 * * *', () => syncHolidays(), { timezone: 'Asia/Seoul' });
syncHolidays();

module.exports = { syncHolidays };
