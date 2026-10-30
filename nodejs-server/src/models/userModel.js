const db = require('../config/db');
const pool = require('../config/dbPromise'); // async 쿼리용 (promise pool)
const bcrypt = require('bcrypt');

const User = {};

User.create = (
    email,
    password,
    name,
    phone,
    companyName,
    companyHomepage,
    companyAddr,
    companyStandard,
    companyNumber,
    companyCode,
    cpId,
    callback
) => {
    // 비밀번호 해싱
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return callback(err, null);
        }

        db.query(
            'INSERT INTO lk_user (user_id, user_email, user_password, user_name, user_phone, cp_id, user_datetime) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [email, email, hash, name, phone, cpId, companyCode],
            (err, results) => {
                if (err) {
                    return callback(err, null);
                }

                return callback(null, results.insertId);
            }
        );
    });
};

User.findByEmail = (userId, callback) => {
    db.query('SELECT * FROM lk_user left join lk_company on lk_user.cp_id = lk_company.cp_id WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results[0]);
    });
};

User.stipUpdate = (userId, stip, type, callback) => {

    console.log(type);

    if(type === "vacation"){
        query = 'UPDATE lk_user SET user_vaca = user_vaca - ? WHERE user_id = ?';
    }else{
        query = 'UPDATE lk_user SET user_stip = user_stip - ? WHERE user_id = ?';
    }
    queryParams = [stip, userId];

    db.query(query, queryParams, (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
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

User.stipUpdateAsync = (userId, stip, type) => {
    return new Promise((resolve, reject) => {
        User.stipUpdate(userId, stip, type, (err, user) => {
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
