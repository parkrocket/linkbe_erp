const db = require('../config/db');
const pool = require('../config/dbPromise');

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

// 회원가입 시 회사 번호 확인용
Company.existsAsync = async cpId => {
    const [rows] = await pool.query('SELECT 1 FROM lk_company WHERE cp_id = ? LIMIT 1', [cpId]);
    return rows.length > 0;
};

module.exports = Company;
