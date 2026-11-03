const cron = require('node-cron');
const Order = require('../models/orderModel');
const slack = require('../utils/slack'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)

// 개인결제 주문 보관 기간 — 주문일 5년(전자상거래법 결제 기록), 결제 대기는 7일 (개인정보 처리방침과 같은 값)
const RETENTION_YEARS = 5;
const PENDING_DAYS = 7;

const notify = text => slack.sendSlackMessage(process.env.SLACK_SHOP_CHANNEL || '#결제', text).catch(() => {}); // 알림 실패는 무시

const purgeOldOrders = async () => {
    try {
        const old = await Order.purgeOlderThan(RETENTION_YEARS);
        const { deleted, kept } = await Order.purgeStalePending(PENDING_DAYS);
        if (old || deleted) console.log(`order retention: 보관 만료 ${old}건·결제 대기 ${deleted}건 삭제`);
        // 결과 모름 주문은 처리될 때까지 매일 알림
        if (kept > 0) await notify(`⚠️ 결제 대기로 ${PENDING_DAYS}일 넘은 주문 중 KCP 승인 결과를 모르는 주문 ${kept}건이 남아 있어요 — 관리 화면에서 확인 후 처리해 주세요`);
        return { old, deleted, kept };
    } catch (error) {
        console.error('order retention failed:', error.message);
        await notify('⚠️ 개인결제 주문 보관 기간 정리에 실패했어요. 서버 로그를 확인해 주세요.');
        return null;
    }
};

// 매일 03:20 한국 시간 (서버 시계는 UTC라 timezone 지정)
cron.schedule('20 3 * * *', () => purgeOldOrders(), { timezone: 'Asia/Seoul' });

module.exports = { purgeOldOrders, RETENTION_YEARS, PENDING_DAYS };
