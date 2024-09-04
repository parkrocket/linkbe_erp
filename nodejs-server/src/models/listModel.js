const db = require('../config/db');

const List = {};

List.findByList = (date, callback) => {
    db.query(
        'SELECT * FROM lk_ctw as ctw LEFT JOIN lk_user as user ON ctw.user_id = user.user_id WHERE ctw.date = ?',
        [date],
        (err, results) => {
            if (err) {
                return callback(err, null);
            }
            return callback(null, results);
        },
    );
};

List.findByListMember = (date, callback) => {
    db.query(
        `SELECT * 
		FROM lk_user as user 
		LEFT JOIN lk_ctw as ctw ON ctw.user_id = user.user_id AND ctw.date = ? 
		LEFT JOIN lk_vacation as vac ON vac.user_id = user.user_id AND vac.date = ? 
		WHERE 1`,
        [date, date],
        (err, results) => {
            if (err) {
                return callback(err, null);
            }
            return callback(null, results);
        },
    );
};

module.exports = List;
