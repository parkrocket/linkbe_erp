const Holiday = require('../models/holidayModel');
const { isDateIn, addDays } = require('../utils/profileValidation');

const MAX_RANGE_DAYS = 366; // 한 해 달력까지

// GET /api/holidays?from=YYYY-MM-DD&to=YYYY-MM-DD — 로그인한 직원 누구나 (달력 표시·신청 달력 선택 막기용)
exports.list = async (req, res) => {
    const { from, to } = req.query;
    if (!isDateIn(from, '2000-01-01', '2100-12-31') || !isDateIn(to, from, addDays(from, MAX_RANGE_DAYS))) {
        return res.status(400).json({ error: 'Invalid range' });
    }
    try {
        res.status(200).json({ holidays: await Holiday.list(from, to) });
    } catch (error) {
        console.error('holiday list error:', error.message);
        res.status(500).json({ error: 'Holiday error' });
    }
};
