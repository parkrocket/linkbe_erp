const Vacation = require('../models/vacationModel');
const { toSafeUser } = require('../utils/safeUser');

exports.list = async (req, res) => {
    // 요청 바디의 user_id 대신 토큰 주인(req.userId)만 조회 — 다른 직원 근태 조회 차단
    let vacation;
    try {
        vacation = await Vacation.findByIdAsync(req.userId);
    } catch (err) {
        // async 핸들러의 처리 안 된 rejection은 Node 22에서 API 프로세스 전체를 종료시킴
        console.error('vacation list error:', err);
        return res.status(500).json({ vacationSuccess: false, error: 'Database query error' });
    }

    return res.json({
        vacationSuccess: true,
        message: 'vacation successful',
        vacationList: vacation.map(toSafeUser), // lk_user 조인 결과의 비밀번호 해시 제거
    });
};

// 사용하는 화면은 없지만 열려 있던 API — 요청 바디의 stipNumber·vacaNumber·userId를 그대로 써서
// 남의 근태 삭제·내 잔여 임의 증가가 가능했음 → 본인 확인하는 근태 취소(apply/applyCancel)로 위임
exports.cancel = (req, res) => require('./applyController').applyCancel(req, res);

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
