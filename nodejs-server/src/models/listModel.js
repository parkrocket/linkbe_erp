const db = require('../config/db');

const List = {};

List.findByList = (date, callback) => {
    db.query('SELECT * FROM lk_ctw WHERE date = ?', [date], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
};

module.exports = List;
