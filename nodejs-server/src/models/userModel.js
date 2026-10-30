const db = require('../config/db');
const pool = require('../config/dbPromise'); // async 쿼리용 (promise pool)
const bcrypt = require('bcrypt');

const User = {};

// 회원가입 저장 — 관리자 승인 전까지 pending (입력값은 registerValidation으로 검증·정규화된 값)
User.create = async ({ email, password, name, phone, cpId, doe, gender, birth }) => {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
        'INSERT INTO lk_user (user_id, user_email, user_password, user_name, user_phone, cp_id, user_doe, user_gender, user_birth, user_role, user_status, user_datetime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [email, email, hash, name, phone, cpId, doe, gender, birth, 'member', 'pending'],
    );
    return result.insertId;
};

User.findByEmail = (userId, callback) => {
    db.query('SELECT * FROM lk_user left join lk_company on lk_user.cp_id = lk_company.cp_id WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results[0]);
    });
};



// 요청마다 계정 상태 확인용 (requireAuth) — 필요한 컬럼만
User.findStatusById = async userId => {
    const [rows] = await pool.query('SELECT user_status, user_role, cp_id FROM lk_user WHERE user_id = ?', [userId]);
    return rows[0];
};

User.findByEmailAsync = (email) => {
    return new Promise((resolve, reject) => {
        User.findByEmail(email, (err, user) => {
            if (err) {
                return reject(err);
            }
            resolve(user);
        });
    });
};

User.comparePassword = (candidatePassword, hash, callback) => {
    bcrypt.compare(candidatePassword, hash, (err, isMatch) => {
        if (err) {
            return callback(err);
        }
        return callback(null, isMatch);
    });
};

module.exports = User;
