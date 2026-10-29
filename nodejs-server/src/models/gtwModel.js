const db = require('../config/db');
const bcrypt = require('bcrypt');

const Gtw = {};

Gtw.create = (userId, type, date, ip, platform, callback) => {
    let query = '';
    let queryParams = [];

    let gtwStatus;
    let location;

    if (type === 'gtw' || type === 'remote_gtw') {
        gtwStatus = 1;
        if (type === 'gtw') location = 'office';
        if (type === 'remote_gtw') location = 'home';
    } else if (type === 'go' || type === 'remote_go') {
        gtwStatus = 2;
        if (type === 'go') location = 'office';
        if (type === 'remote_go') location = 'home';
    }

    if (type === 'gtw' || type === 'remote_gtw') {
        query =
            'INSERT INTO lk_ctw (user_id, ip, start_time, platform, date, location) VALUES (?, ?, NOW(), ?, ?, ?)';
        queryParams = [userId, ip, platform, date, location];
    } else {
        query =
            'UPDATE lk_ctw SET end_time = NOW(), ip = ?, platform = ?, location =? WHERE user_id = ? AND date = ?';
        queryParams = [ip, platform, location, userId, date];
    }

    db.query(query, queryParams, (err, results) => {
        console.log(err);
        if (err) {
            return callback(err, null);
        }

        db.query(
            'UPDATE lk_user SET gtw_status = ?, gtw_location = ? WHERE user_id = ?',
            [gtwStatus, location, userId],
            (err, results) => {
                if (err) {
                    return callback(err, null);
                }

                return callback(null, results.insertId);
            },
        );
    });
};

Gtw.findByGtw = (userId, date, callback) => {
    query =
        'SELECT * FROM lk_ctw as ctw LEFT JOIN lk_user as user ON ctw.user_id = user.user_id WHERE ctw.user_id = ?  AND ctw.date = ? ORDER BY ctw.date DESC LIMIT 1';
    queryParams = [userId, date];

    db.query(query, queryParams, (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
};

Gtw.findByGtwAll = (date, callback) => {
    query =
        'SELECT * FROM lk_ctw as ctw LEFT JOIN lk_user as user ON ctw.user_id = user.user_id WHERE ctw.date = ? ORDER BY ctw.date DESC';
    queryParams = [date];

    db.query(query, queryParams, (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
};

// 팀 근태: 토큰 주인과 같은 회사 직원별 오늘 출퇴근·근태
// SELECT * 는 세 테이블의 user_id가 충돌해 근태 없는 직원의 user_id가 NULL로 덮였음 → 필요한 컬럼만
// 회사는 요청 값 대신 로그인 사용자(userId)의 cp_id로 결정 — 다른 회사 직원 목록 조회 차단
Gtw.findByGtwAllWeb = (date, userId, callback) => {
    const query = `
        SELECT user.user_id, user.user_name, user.gtw_location,
               ctw.start_time, ctw.end_time,
               vac.type, vac.date AS vac_date
        FROM lk_user AS user
        LEFT JOIN lk_ctw AS ctw ON ctw.user_id = user.user_id AND ctw.date = ?
        LEFT JOIN lk_vacation AS vac ON vac.user_id = user.user_id AND vac.date = ?
        WHERE user.cp_id = (SELECT cp_id FROM lk_user WHERE user_id = ?)
        ORDER BY ctw.date DESC
    `;
    const queryParams = [date, date, userId];

    db.query(query, queryParams, (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
};

Gtw.findByGtwAllAsync = date => {
    return new Promise((resolve, reject) => {
        Gtw.findByGtwAll(date, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

Gtw.findByGtwAsync = (userId, date) => {
    return new Promise((resolve, reject) => {
        Gtw.findByGtw(userId, date, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

Gtw.createAsync = (userId, type, date, ip, platform) => {
    return new Promise((resolve, reject) => {
        Gtw.create(userId, type, date, ip, platform, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

Gtw.findByGtwStatus = (userId, date, callback) => {
    db.query(
        'SELECT * FROM lk_ctw WHERE user_id = ? AND DATE(date) = ?',
        [userId, date],
        (err, results) => {
            if (err) {
                return callback(err, null);
            }

            return callback(null, results[0]);
        },
    );
};

Gtw.findByGtwWeeklyStatus = (userId, date, callback) => {
    db.query(
        'SELECT * FROM lk_ctw WHERE user_id = ? AND YEAR(date) = YEAR(?) AND WEEK(date, 1) = WEEK(?, 1)',
        [userId, date, date],
        (err, results) => {
            if (err) {
                return callback(err, null);
            }

            return callback(null, results);
        },
    );
};

module.exports = Gtw;
