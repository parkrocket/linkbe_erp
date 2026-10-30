const db = require('../config/db');

// 근태 조회 전용 — 신청·취소(잔여 변경)는 applyModel만 (잔여 장부 기록)
const Vca = {};

// 오늘 근태도 포함되도록 CURDATE() 기준 (DATE >= NOW()는 오늘 00:00 < 현재시각이라 오늘을 제외했음)
Vca.findById = (userId, callback) => {
    query =
        'SELECT * FROM lk_vacation LEFT JOIN lk_user ON lk_vacation.user_id = lk_user.user_id WHERE lk_vacation.user_id =? AND lk_vacation.date >= CURDATE()';
    queryParams = [userId];

    db.query(query, queryParams, (err, results) => {
        console.log(err);
        if (err) {
            return callback(err, null);
        }

        return callback(null, results);
    });
};

Vca.findByAll = (userId, callback) => {
    const query =
        'SELECT * FROM lk_vacation LEFT JOIN lk_user ON lk_vacation.user_id = lk_user.user_id WHERE lk_vacation.date >= CURDATE() ORDER BY lk_vacation.date ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.log(err);
            return callback(err, null);
        }

        return callback(null, results);
    });
};

Vca.findByIdAsync = userId => {
    return new Promise((resolve, reject) => {
        Vca.findById(userId, (err, results) => {
            if (err) {
                return reject(err);
            }

            resolve(results);
        });
    });
};

Vca.findByAllAsync = userId => {
    return new Promise((resolve, reject) => {
        Vca.findByAll(userId, (err, results) => {
            if (err) {
                return reject(err);
            }

            resolve(results);
        });
    });
};

Vca.findByVcaWeeklyStatus = (userId, date, callback) => {
    db.query(
        'SELECT * FROM lk_vacation WHERE user_id = ? AND YEAR(date) = YEAR(?) AND WEEK(date, 1) = WEEK(?, 1)',
        [userId, date, date],
        (err, results) => {
            if (err) {
                return callback(err, null);
            }

            return callback(null, results);
        },
    );
};

module.exports = Vca;
