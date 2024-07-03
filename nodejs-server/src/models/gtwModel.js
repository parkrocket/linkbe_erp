const db = require('../config/db');
const bcrypt = require('bcrypt');

const Gtw = {};

Gtw.create = (userId, type, ip, platform, callback) => {
    db.query('INSERT INTO lk_ctw (user_id, type, ip, datetime, platform) VALUES (?, ?, ?, NOW(),?)', [userId, type, ip, platform], (err, results) => {
        if (err) {
            return callback(err, null);
        }

        return callback(null, results.insertId);
    });
};

Gtw.findByEmail = (userId, datetime, type, callback) => {
    db.query('SELECT * FROM lk_user WHERE mb_email = ?', [email], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results[0]);
    });
};

module.exports = Gtw;
