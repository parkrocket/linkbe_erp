const db = require('../config/db');
const bcrypt = require('bcrypt');

const User = {};

User.create = (email, password, name, phone, companyName, companyHomepage, companyAddr, companyStandard, companyNumber, companyCode, callback) => {
    // 비밀번호 해싱
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return callback(err, null);
        }

        db.query(
            'INSERT INTO lk_user (user_id, user_email, user_password, user_name, user_phone, company_name, company_homepage, company_addr, company_standard, company_number, company_code, user_datetime) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [email, email, hash, name, phone, companyName, companyHomepage, companyAddr, companyStandard, companyNumber, companyCode],
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
    db.query('SELECT * FROM lk_user WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results[0]);
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
