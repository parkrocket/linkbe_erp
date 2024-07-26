const db = require('../config/db');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');
const { sendSlackMessage } = require('../utils/slack');

const Vca = {};
/*
const auths = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar'],
);
*/
Vca.create = (userId, type, date, eventId, callback) => {
    query =
        'INSERT INTO lk_vacation (user_id, type ,date, va_datetime, calendar_id) VALUES (?, ?, ?, NOW(), ?)';
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
    query =
        'SELECT * FROM lk_vacation LEFT JOIN lk_user ON lk_vacation.user_id = lk_user.user_id WHERE lk_vacation.user_id =? AND lk_vacation.date >= NOW()';
    queryParams = [userId];

    db.query(query, queryParams, (err, results) => {
        console.log(err);
        if (err) {
            return callback(err, null);
        }

        return callback(null, results);
    });
};

Vca.findByAll = (userId, callback) => {
    const query =
        'SELECT * FROM lk_vacation LEFT JOIN lk_user ON lk_vacation.user_id = lk_user.user_id WHERE lk_vacation.date >= CURDATE() ORDER BY lk_vacation.date ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.log(err);
            return callback(err, null);
        }

        return callback(null, results);
    });
};

Vca.cancel = (id, stipNumber, vacaNumber, userId, calendar_id, type) => {
    return new Promise((resolve, reject) => {
        const deleteQuery = 'DELETE FROM lk_vacation WHERE id = ?';

        db.query(deleteQuery, [id], async (err, results) => {
            if (err) {
                console.log(err);
                return reject(err);
            }

            if (calendar_id) {
                const calendar = google.calendar({
                    version: 'v3',
                    auth: auths,
                });

                try {
                    await calendar.events.delete({
                        calendarId: process.env.GOOGLE_CALENDAR_ID,
                        eventId: calendar_id,
                    });

                    console.log('Event deleted:', calendar_id);
                } catch (error) {
                    console.error('Error deleting event:', error);
                    return reject(error);
                }
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

                const vacaType =
                    {
                        half: '반차',
                        day: '연차',
                        home: '재택',
                        vacation: '휴가',
                    }[type] || '알수없음';

                const message = `${userId}님이 ${vacaType}을(를) 취소하셨습니다.`;

                sendSlackMessage('#출퇴근', message);

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

Vca.findByIdAsync = userId => {
    return new Promise((resolve, reject) => {
        Vca.findById(userId, (err, results) => {
            if (err) {
                return reject(err);
            }

            resolve(results);
        });
    });
};

Vca.findByAllAsync = userId => {
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
