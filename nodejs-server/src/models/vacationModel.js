const db = require('../config/db');
const bcrypt = require('bcrypt');

const Vca = {};

Vca.create = (userId, type, date, callback) => {
    query = 'INSERT INTO lk_vacation (user_id, type ,date, va_datetime) VALUES (?, ?, ?, NOW())';
    queryParams = [userId, type, date];

    db.query(query, queryParams, (err, results) => {
        console.log(err);
        if (err) {
            return callback(err, null);
        }

        return callback(null, results.insertId);
    });
};

Vca.findById = (userId, callback) => {
    query = 'SELECT * from lk_vacation WHERE user_id =? AND date >= NOW()';
    queryParams = [userId];

    console.log(userId);

    db.query(query, queryParams, (err, results) => {
        console.log(err);
        if (err) {
            return callback(err, null);
        }

        return callback(null, results.insertId);
    });
};

Vca.createAsync = (userId, type, date) => {
    return new Promise((resolve, reject) => {
        Vca.create(userId, type, date, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

Vca.findByIdAsync = (userId) => {
    return new Promise((resolve, reject) => {
        Vca.findById(userId, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

module.exports = Vca;
