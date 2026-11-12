const Vacation = require('../models/vacationModel');
const { toSafeUser } = require('../utils/safeUser');
const pool = require('../config/dbPromise'); // 호출 시점 참조 (점검 스크립트에서 가짜 교체)
const { isDateIn, addDays } = require('../utils/profileValidation');

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

// 같은 회사 팀원 근태(본인 제외) — 근태 신청 달력에 '이날 쉬는 사람' 표시용
// 직원은 이미 일정 화면(/calendar)에서 모두의 근태를 보므로 새로 공개되는 정보 없음. 이름·종류·날짜만
const TEAM_MAX_DAYS = 62; // 월 달력 1~2달
exports.team = async (req, res) => {
    const { from, to } = req.query;
    if (!isDateIn(from, '2000-01-01', '2100-12-31') || !isDateIn(to, from, addDays(from, TEAM_MAX_DAYS))) {
        return res.status(400).json({ error: 'Invalid range' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT DATE_FORMAT(v.date, '%Y-%m-%d') AS date, v.type, u.user_name AS name
             FROM lk_vacation v JOIN lk_user u ON u.user_id = v.user_id
             WHERE u.cp_id = ? AND v.user_id <> ? AND v.date BETWEEN ? AND ?
             ORDER BY v.date, u.user_name`,
            [req.userCpId, req.userId, from, to],
        );
        res.status(200).json({ leaves: rows });
    } catch (error) {
        console.error('team leave error:', error.message);
        res.status(500).json({ error: 'Database query error' });
    }
};

// 사용하는 화면은 없지만 열려 있던 API — 요청 바디의 stipNumber·vacaNumber·userId를 그대로 써서
// 남의 근태 삭제·내 잔여 임의 증가가 가능했음 → 본인 확인하는 근태 취소(apply/applyCancel)로 위임
exports.cancel = (req, res) => require('./applyController').applyCancel(req, res);

exports.vcaWeeklyStatus = (req, res) => {
    //const date = moment().format('YYYY-MM-DD');

    const userId = req.userId; // 토큰 주인만 (바디 userId로 남의 기록 조회 차단)
    const { date } = req.body;

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
