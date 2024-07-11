const db = require('../config/db');
const bcrypt = require('bcrypt');

const Gtw = {};

Gtw.create = (userId, type, date, ip, platform, callback) => {
    let query = '';
    let queryParams = [];

    if (type === 'gtw') {
        query = 'INSERT INTO lk_ctw (user_id, ip, start_time, platform, date) VALUES (?, ?, NOW(), ?, ?)';
        queryParams = [userId, ip, platform, date];
    } else {
        query = 'UPDATE lk_ctw SET end_time = NOW(), ip = ?, platform = ? WHERE user_id = ? AND date = ?';
        queryParams = [ip, platform, userId, date];
    }

    db.query(query, queryParams, (err, results) => {
        console.log(err);
        if (err) {
            return callback(err, null);
        }

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

        console.log(location);

        db.query('UPDATE lk_user SET gtw_status = ?, gtw_location = ? WHERE user_id = ?', [gtwStatus, location, userId], (err, results) => {
            if (err) {
                return callback(err, null);
            }

            return callback(null, results.insertId);
        });
    });
};

Gtw.findByGtw = (userId, type, date, callback) => {
    query = 'SELECT * FROM lk_ctw WHERE user_id = ?  AND date = ? ORDER BY date DESC LIMIT 1';
    queryParams = [userId, date];

    db.query(query, queryParams, (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
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
