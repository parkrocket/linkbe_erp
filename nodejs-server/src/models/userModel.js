const db = require('../config/db');
const bcrypt = require('bcrypt');

const User = {};

User.create = (email, password, callback) => {
    // 비밀번호 해싱
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return callback(err, null);
        }

        db.query('INSERT INTO lk_user (mb_id, mb_email, mb_password, mb_datetime) VALUES (?, ?, ?, NOW())', [email, email, hash], (err, results) => {
            if (err) {
                return callback(err, null);
            }

            return callback(null, results.insertId);
        });
    });
};

User.findByEmail = (email, callback) => {
    db.query('SELECT * FROM lk_user WHERE mb_email = ?', [email], (err, results) => {
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
