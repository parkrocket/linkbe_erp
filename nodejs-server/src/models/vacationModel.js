const db = require('../config/db');
const bcrypt = require('bcrypt');

const Vca = {};

Vca.create = (userId, type, date, eventId, callback) => {
    query = 'INSERT INTO lk_vacation (user_id, type ,date, va_datetime, calendar_id) VALUES (?, ?, ?, NOW(), ?)';
    queryParams = [userId, type, date, eventId];

    db.query(query, queryParams, (err, results) => {
        console.log(err);
        if (err) {
            return callback(err, null);
        }

        return callback(null, results.insertId);
    });
};

Vca.findById = (userId, callback) => {
    query = 'SELECT * FROM lk_vacation LEFT JOIN lk_user ON lk_vacation.user_id = lk_user.user_id WHERE lk_vacation.user_id =? AND lk_vacation.date >= NOW()';
    queryParams = [userId];

    db.query(query, queryParams, (err, results) => {
        console.log(err);
        if (err) {
            return callback(err, null);
        }

        return callback(null, results);
    });
};

Vca.findByAll = (userId,callback) => {
    const query = 'SELECT * FROM lk_vacation LEFT JOIN lk_user ON lk_vacation.user_id = lk_user.user_id WHERE lk_vacation.date >= NOW() ORDER BY lk_vacation.date ASC';


    db.query(query, (err, results) => {
        if (err) {
            console.log(err);
            return callback(err, null);
        }

        return callback(null, results);
    });
};


Vca.cancel = (id, stipNumber, vacaNumber, userId) => {
    return new Promise((resolve, reject) => {
        const deleteQuery = 'DELETE FROM lk_vacation WHERE id = ?';
        
        db.query(deleteQuery, [id], (err, results) => {
            if (err) {
                console.log(err);
                return reject(err);
            }

            let updateQuery = 'UPDATE lk_user SET ';
            const params = [];

            if (stipNumber) {
                updateQuery += 'user_stip = user_stip + ?';
                params.push(stipNumber);
            }

            if (vacaNumber) {
                if (stipNumber) {
                    updateQuery += ', ';
                }
                updateQuery += 'user_vaca = user_vaca + ?';
                params.push(vacaNumber);
            }

            updateQuery += ' WHERE user_id = ?';
            params.push(userId);

            db.query(updateQuery, params, (err, updateResults) => {
                if (err) {
                    console.log(err);
                    return reject(err);
                }

                resolve(updateResults);
            });
        });
    });
};



Vca.createAsync = (userId, type, date, eventId) => {
    return new Promise((resolve, reject) => {
        Vca.create(userId, type, date, eventId, (err, results) => {
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

Vca.findByAllAsync = (userId) => {

    return new Promise((resolve, reject) => {
        Vca.findByAll(userId, (err, results) => {
            if (err) {
                return reject(err);
            }

            resolve(results);
        });
    });
};

module.exports = Vca;
