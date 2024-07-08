const db = require('../config/db');

const List = {};

List.findByList = (date, callback) => {
    db.query('SELECT * FROM lk_ctw as ctw LEFT JOIN lk_user as user ON ctw.user_id = user.user_id WHERE ctw.date = ?', [date], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
};

module.exports = List;
