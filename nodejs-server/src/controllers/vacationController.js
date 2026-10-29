const Vacation = require('../models/vacationModel');
const { toSafeUser } = require('../utils/safeUser');

exports.list = async (req, res) => {
    // 요청 바디의 user_id 대신 토큰 주인(req.userId)만 조회 — 다른 직원 근태 조회 차단
    const vacation = await Vacation.findByIdAsync(req.userId);

    return res.json({
        vacationSuccess: true,
        message: 'vacation successful',
        vacationList: vacation.map(toSafeUser), // lk_user 조인 결과의 비밀번호 해시 제거
    });
};

exports.cancel = async (req, res) => {
    const { id, stipNumber, vacaNumber, userId, calendar_id, type } = req.body;

    const vacation = await Vacation.cancel(
        id,
        stipNumber,
        vacaNumber,
        userId,
        calendar_id,
        type,
    );

    return res.json({
        vacationCancelSuccess: true,
        message: 'vacation Cancel successful',
        vacationList: vacation,
    });
};

exports.vcaWeeklyStatus = (req, res) => {
    //const date = moment().format('YYYY-MM-DD');

    const { userId, date } = req.body;

    Vacation.findByVcaWeeklyStatus(userId, date, (err, gtw) => {
        if (err) {
            return res
                .status(200)
                .json({ gtwSuccess: false, error: 'Database query error' });
        }

        //console.log(gtw);
        return res.status(200).json({ gtwSuccess: true, gtw });
    });
};
