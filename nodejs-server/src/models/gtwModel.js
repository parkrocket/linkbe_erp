const db = require('../config/db');
const bcrypt = require('bcrypt');

const Gtw = {};

Gtw.create = (userId, type, ip, platform, callback) => {
    db.query('INSERT INTO lk_ctw (user_id, type, ip, datetime, platform) VALUES (?, ?, ?, NOW(),?)', [userId, type, ip, platform], (err, results) => {
        let gtwStatus = 0;
        if (err) {
            return callback(err, null);
        }

        if (type === 'gtw') {
            gtwStatus = 1;
        } else {
            gtwStatus = 0;
        }

        db.query('UPDATE lk_user SET gtw_status = ? WHERE user_id = ?', [gtwStatus, userId], (err, results) => {
            if (err) {
                return callback(err, null);
            }

            return callback(null, results.insertId);
        });
    });
};

Gtw.findByGtw = (userId, type, date, callback) => {
    if (type === 'gtw') {
        db.query('SELECT * FROM lk_ctw WHERE user_id = ?  AND DATE(datetime) = ? ORDER BY datetime DESC LIMIT 1', [userId, date], (err, results) => {
            if (err) {
                return callback(err, null);
            }
            return callback(null, results);
        });
    } else {
        db.query(
            'SELECT * FROM lk_ctw WHERE user_id = ? AND type = ?  AND DATE(datetime) = ? ORDER BY datetime DESC LIMIT 1',
            [userId, type, date],
            (err, results) => {
                if (err) {
                    return callback(err, null);
                }
                return callback(null, results);
            }
        );
    }
};

//미사용
Gtw.findByGtwStatus = (userId, date, callback) => {
    db.query('SELECT * FROM lk_ctw WHERE user_id = ? AND DATE(datetime) = ? ORDER BY datetime DESC', [userId, date], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
};

module.exports = Gtw;
