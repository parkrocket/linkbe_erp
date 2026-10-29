const db = require('../config/db');

const Company = {};

// 회원가입용 공개 목록 — 번호·이름만 (기존 SELECT *는 사무실 IP·사업자번호·회사코드까지 로그인 없이 노출)
Company.findByList = callback => {
    db.query('SELECT cp_id, cp_name FROM lk_company', (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
};

Company.findById = (cpId, callback) => {
    db.query(
        'SELECT * FROM lk_company WHERE cp_id = ?',
        [cpId],
        (err, results) => {
            if (err) {
                return callback(err, null);
            }
            return callback(null, results[0]);
        },
    );
};

module.exports = Company;
