const Apply = require('../models/applyModel');

// 근태 신청·취소 — 사용자는 항상 토큰 주인(req.userId). 요청 바디의 userId/userName/type/calendar_id는 신뢰하지 않음
// 실패는 HTTP 상태 코드로 응답 (기존: 실패도 200이라 화면에 '신청 완료'가 뜸)

const sendError = (res, error, fallbackKey) => {
    const status = error.status || 500;
    if (status === 500) console.error(`${fallbackKey} error:`, error.response?.data || error.message);
    return res.status(status).json({ [fallbackKey]: false, error: error.message });
};

exports.applyIn = async (req, res) => {
    const { date, dates, type } = req.body;
    try {
        // 새 화면은 dates(여러 날), 기존 react-app은 date(하루)
        const ids = await Apply.insertMany({ userId: req.userId, dates: Array.isArray(dates) ? dates : [date], type });
        return res.status(200).json({ gtwSuccess: true, gtw: ids.length === 1 ? ids[0] : ids });
    } catch (error) {
        return sendError(res, error, 'gtwSuccess');
    }
};

exports.applyCancel = async (req, res) => {
    const { id } = req.body;
    try {
        await Apply.cancel({ id, userId: req.userId });
        return res.status(200).json({ vacationCancelSuccess: true });
    } catch (error) {
        return sendError(res, error, 'vacationCancelSuccess');
    }
};
