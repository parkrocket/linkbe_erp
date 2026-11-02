const cron = require('node-cron');
const Homepage = require('../models/homepageModel');
const uploads = require('../utils/uploads'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)
const slack = require('../utils/slack');

// 홈페이지 문의 개인정보 보관 기간 — 접수 후 3년 지나면 문의·첨부 삭제 (개인정보 처리방침과 같은 값)
const RETENTION_YEARS = 3;

const purgeOldInquiries = async () => {
    try {
        const { inquiries, files } = await Homepage.purgeInquiriesOlderThan(RETENTION_YEARS);
        for (const name of files) uploads.removeUpload(name, 'private');
        if (inquiries) console.log(`inquiry retention: 문의 ${inquiries}건·첨부 ${files.length}개 삭제`);
        return { inquiries, files: files.length };
    } catch (error) {
        console.error('inquiry retention failed:', error.message);
        // 조용히 실패하면 보관 기간을 넘긴 개인정보가 계속 남음 — 관리 채널에 알림 (알림 실패는 무시)
        await slack.sendSlackMessage('#hibye-관리', '⚠️ 홈페이지 문의 보관 기간(3년) 정리에 실패했어요. 서버 로그를 확인해 주세요.').catch(() => {});
        return null;
    }
};

// 매일 03:10 한국 시간 (서버 시계는 UTC라 timezone 지정)
cron.schedule('10 3 * * *', () => purgeOldInquiries(), { timezone: 'Asia/Seoul' });

module.exports = { purgeOldInquiries, RETENTION_YEARS };
